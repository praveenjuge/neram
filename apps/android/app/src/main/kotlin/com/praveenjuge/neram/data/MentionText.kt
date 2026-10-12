package com.praveenjuge.neram.data

import com.praveenjuge.neram.data.model.Mention

/**
 * Comment bodies store mentions as UTF-16 offsets, the same units as JavaScript strings on the
 * server and web, and as Kotlin string indices. Mirrors NeramKit's `MentionText`.
 */
object MentionText {
    sealed interface Segment {
        data class Text(val text: String) : Segment

        data class Tag(val mention: Mention) : Segment
    }

    /** A `@query` being typed: the text after the `@`, and where the `@` is. */
    data class Query(val query: String, val start: Int)

    /**
     * Splits [body] into plain text and mention runs, in order. Mentions that overlap, fall outside
     * the body, or split a character are rendered as plain text.
     */
    fun segments(body: String, mentions: List<Mention>): List<Segment> {
        val segments = mutableListOf<Segment>()
        var cursor = 0
        for (mention in mentions.sortedBy { it.start }) {
            val start = mention.start.toInt()
            val end = start + mention.length.toInt()
            if (start < cursor || end > body.length || mention.length <= 0) continue
            if (!isBoundary(body, start) || !isBoundary(body, end)) continue
            if (start > cursor) segments += Segment.Text(body.substring(cursor, start))
            segments += Segment.Tag(mention)
            cursor = end
        }
        if (cursor < body.length) segments += Segment.Text(body.substring(cursor))
        return segments
    }

    /**
     * The `@query` being typed just before [caret], like the web composer: the `@` must start the
     * text or follow a space or newline, and the query stops at whitespace.
     */
    fun query(text: String, caret: Int): Query? {
        var index = caret.coerceIn(0, text.length)
        while (index > 0) {
            val character = text[index - 1]
            if (character == '@') {
                val at = index - 1
                if (at > 0 && text[at - 1] != ' ' && text[at - 1] != '\n') return null
                return Query(text.substring(at + 1, caret), at)
            }
            if (character == ' ' || character == '\n') return null
            index -= 1
        }
        return null
    }

    /**
     * Mention spans for the tokens (subject to label) inserted into [body], in text order. Each
     * token takes the first `@label` not already taken, so mentions picked in any order (a name
     * inserted before an earlier one) all count, and a name mentioned twice gets two spans. Tokens
     * whose text was deleted are dropped.
     */
    fun mentions(body: String, tokens: List<Pair<String, String>>): List<Mention> {
        val taken = mutableListOf<IntRange>()
        val mentions = mutableListOf<Mention>()
        for ((subject, label) in tokens) {
            val text = "@$label"
            var start = body.indexOf(text)
            while (start >= 0) {
                val span = start until start + text.length
                if (taken.none { it.first <= span.last && span.first <= it.last }) break
                start = body.indexOf(text, start + 1)
            }
            if (start < 0) continue
            taken += start until start + text.length
            mentions += Mention(start.toDouble(), text.length.toDouble(), subject, label)
        }
        return mentions.sortedBy { it.start }
    }

    /** Whether [index] falls between characters, not inside a surrogate pair. */
    private fun isBoundary(text: String, index: Int) =
        index == 0 || index == text.length || !text[index].isLowSurrogate()
}
