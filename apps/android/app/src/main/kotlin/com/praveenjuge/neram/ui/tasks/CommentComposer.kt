package com.praveenjuge.neram.ui.tasks

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import com.praveenjuge.neram.data.MentionText
import com.praveenjuge.neram.data.model.Member
import com.praveenjuge.neram.data.model.Mention
import com.praveenjuge.neram.data.prefixUtf16
import com.praveenjuge.neram.ui.common.UserAvatar

private const val COMMENT_LIMIT = 5000

/** Mention tokens (subject to label) as a flat list of strings, which a Bundle can hold. */
private val tokenSaver =
    listSaver<List<Pair<String, String>>, String>(
        save = { tokens -> tokens.flatMap { listOf(it.first, it.second) } },
        restore = { flat -> flat.chunked(2).map { it[0] to it[1] } },
    )

/**
 * A comment field with @mention suggestions, like the web composer. Typing `@` after a space
 * suggests members; picking one inserts `@Name ` and records it, and Post sends UTF-16 mention
 * spans for the names still in the text. [onSubmit] reports whether the comment was saved; only
 * then is the text cleared, and only if nothing was typed meanwhile.
 */
@Composable
fun CommentComposer(
    members: List<Member>,
    enabled: Boolean,
    running: Boolean,
    onSubmit: (body: String, mentions: List<Mention>, onDone: (Boolean) -> Unit) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Write a comment…",
    initialBody: String = "",
    initialMentions: List<Mention> = emptyList(),
    autoFocus: Boolean = false,
    onCancel: (() -> Unit)? = null,
    /** After a post that cleared the field; not when newer typing was kept. */
    onPosted: () -> Unit = {},
) {
    // Editing continues from the end of the existing text.
    var value by
        rememberSaveable(stateSaver = TextFieldValue.Saver) {
            mutableStateOf(TextFieldValue(initialBody, TextRange(initialBody.length)))
        }
    // Kept with the text, so a draft restored after rotation or scrolling still mentions people.
    var tokens by
        rememberSaveable(stateSaver = tokenSaver) {
            mutableStateOf(initialMentions.map { it.subject to it.label })
        }
    var focused by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { if (autoFocus) focus.requestFocus() }

    val caret = value.selection.takeIf { it.collapsed }?.start
    val query = caret?.takeIf { focused }?.let { MentionText.query(value.text, it) }
    val matches =
        query
            ?.let { found ->
                val needle = found.query.lowercase()
                members
                    .filter { needle.isEmpty() || it.displayName.lowercase().contains(needle) }
                    .take(8)
            }
            .orEmpty()

    fun insert(member: Member) {
        val found = query ?: return
        // The query runs from its `@` to the caret.
        val start = found.start
        val end = start + 1 + found.query.length
        val insertion = "@${member.displayName} "
        val text = value.text.replaceRange(start, end, insertion)
        if (text.length > COMMENT_LIMIT) return
        value = TextFieldValue(text, TextRange(start + insertion.length))
        tokens = tokens + (member.userId to member.displayName)
    }

    fun submit() {
        val text = value.text
        if (text.isBlank()) return
        onSubmit(text, MentionText.mentions(text, tokens)) { posted ->
            // Keep anything typed while posting; clear only what was sent.
            if (posted && value.text == text) {
                value = TextFieldValue("")
                tokens = emptyList()
                onPosted()
            }
        }
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // Above the field: the field scrolls to sit just over the keyboard, so anything below it
        // would be hidden.
        if (matches.isNotEmpty()) {
            Column {
                matches.forEach { member ->
                    ListItem(
                        modifier = Modifier.clickable { insert(member) },
                        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                        leadingContent = { UserAvatar(member.displayName) },
                    ) {
                        Text("@${member.displayName}")
                    }
                }
            }
        }
        OutlinedTextField(
            value = value,
            onValueChange = { next ->
                val text = next.text.prefixUtf16(COMMENT_LIMIT)
                value =
                    if (text == next.text) next
                    else
                        TextFieldValue(
                            text,
                            TextRange(next.selection.end.coerceAtMost(text.length)),
                        )
            },
            placeholder = { Text(placeholder) },
            enabled = enabled,
            minLines = 2,
            maxLines = 10,
            modifier =
                Modifier.fillMaxWidth().focusRequester(focus).onFocusChanged {
                    focused = it.isFocused
                },
        )
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
        ) {
            onCancel?.let { TextButton(onClick = it, enabled = !running) { Text("Cancel") } }
            Button(
                onClick = ::submit,
                enabled = enabled && !running && value.text.isNotBlank(),
            ) {
                Text(if (running) "Posting…" else "Post")
            }
        }
    }
}
