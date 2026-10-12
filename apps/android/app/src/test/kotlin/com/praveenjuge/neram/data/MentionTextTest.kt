package com.praveenjuge.neram.data

import com.praveenjuge.neram.data.MentionText.Segment
import com.praveenjuge.neram.data.model.Mention
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MentionTextTest {
    private val bob = Mention(10.0, 4.0, "user_bob", "Bob")

    @Test
    fun emojiCountsAsTwoUtf16Units() {
        // Same body and offsets as the server fixture taskComments.list.
        assertEquals(
            listOf(Segment.Text("Thanks 👋 "), Segment.Tag(bob)),
            MentionText.segments("Thanks 👋 @Bob", listOf(bob)),
        )
    }

    @Test
    fun invalidMentionsStayPlainText() {
        val outside = Mention(50.0, 3.0, "user_x", "X")
        assertEquals(listOf(Segment.Text("Hello")), MentionText.segments("Hello", listOf(outside)))
        // Splitting the waving hand's surrogate pair isn't a valid span.
        val split = Mention(8.0, 2.0, "user_x", "X")
        assertEquals(
            listOf(Segment.Text("Thanks 👋 @Bob")),
            MentionText.segments("Thanks 👋 @Bob", listOf(split)),
        )
    }

    @Test
    fun textAfterMentionIsKept() {
        val segments =
            MentionText.segments(
                "@Bob please review",
                listOf(Mention(0.0, 4.0, "user_bob", "Bob")),
            )
        assertEquals(2, segments.size)
        assertEquals(Segment.Text(" please review"), segments.last())
    }

    @Test
    fun queryNeedsAnAtAfterSpaceOrStart() {
        assertEquals(MentionText.Query("bo", 3), MentionText.query("Hi @bo", 6))
        assertEquals("", MentionText.query("@", 1)?.query)
        assertNull(MentionText.query("mail@bo", 7))
        assertNull(MentionText.query("@bo b", 5))
        assertEquals("al", MentionText.query("Hey\n@al", 7)?.query)
    }

    @Test
    fun mentionsFollowTokensInOrderWithUtf16Offsets() {
        val body = "👋 @Bob and @Al, then @Bob"
        val mentions =
            MentionText.mentions(
                body,
                listOf(
                    "user_bob" to "Bob",
                    "user_al" to "Al",
                    "user_bob" to "Bob",
                    "user_cy" to "Cy",
                ),
            )
        assertEquals(listOf("user_bob", "user_al", "user_bob"), mentions.map { it.subject })
        // The emoji is two UTF-16 units, so "@Bob" starts at 3, not 2.
        assertEquals(listOf(3, 12, 22), mentions.map { it.start.toInt() })
        assertEquals(6, MentionText.segments(body, mentions).size)
    }

    @Test
    fun mentionsPickedOutOfTextOrderAllCount() {
        // @Bob was picked first, then @Al inserted before it.
        val mentions =
            MentionText.mentions("@Al @Bob", listOf("user_bob" to "Bob", "user_al" to "Al"))
        assertEquals(listOf("user_al", "user_bob"), mentions.map { it.subject })
        assertEquals(listOf(0, 4), mentions.map { it.start.toInt() })
    }

    @Test
    fun aNameMentionedTwiceGetsTwoSpans() {
        val mentions =
            MentionText.mentions("@Bob and @Bob", listOf("user_bob" to "Bob", "user_bob" to "Bob"))
        assertEquals(listOf(0, 9), mentions.map { it.start.toInt() })
    }
}
