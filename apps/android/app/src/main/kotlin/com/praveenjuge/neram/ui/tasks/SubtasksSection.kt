package com.praveenjuge.neram.ui.tasks

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.praveenjuge.neram.data.Call
import com.praveenjuge.neram.data.Calls
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.model.Subtask
import com.praveenjuge.neram.data.prefixUtf16
import com.praveenjuge.neram.ui.common.Live

private const val SUBTASK_LIMIT = 200

/**
 * The subtask list's drafts and in-flight requests. Owned by the task's view model, not the list's
 * rows, so scrolling a row away never loses a draft or forgets a request still running. [run]
 * performs a change and reports whether it worked.
 */
class SubtaskEdits(
    private val taskId: DocumentId,
    private val run: (Call<*>, (Boolean) -> Unit) -> Unit,
) {
    /** The add field's text; kept until the server accepts it, so a failed add can be retried. */
    var newTitle by mutableStateOf("")
        private set

    var adding by mutableStateOf(false)
        private set

    private val drafts = mutableStateMapOf<DocumentId, String>()
    /** The latest title sent per subtask, until the live subtask shows it. */
    private val sent = mutableStateMapOf<DocumentId, String>()
    private val renaming = mutableStateMapOf<DocumentId, Int>()

    fun changeNewTitle(value: String) {
        newTitle = value.replace('\n', ' ').prefixUtf16(SUBTASK_LIMIT)
    }

    fun add() {
        val title = newTitle.trim()
        if (title.isEmpty() || adding) return
        adding = true
        run(Calls.createSubtask(taskId, title)) { added ->
            if (added && newTitle.trim() == title) newTitle = ""
            adding = false
        }
    }

    /** The title as far as this screen knows, counting renames still in flight. */
    private fun known(subtask: Subtask) = sent[subtask.id] ?: subtask.title

    fun text(subtask: Subtask) = drafts[subtask.id] ?: known(subtask)

    fun change(subtask: Subtask, value: String) {
        drafts[subtask.id] = value.replace('\n', ' ').prefixUtf16(SUBTASK_LIMIT)
    }

    /**
     * Renames compare against the latest title sent, so a quick change back is saved too. The draft
     * stays until its rename succeeds; after a failure, committing again retries it.
     */
    fun commit(subtask: Subtask) {
        val id = subtask.id
        val value = drafts[id]?.trim() ?: return
        if (value.isEmpty()) {
            drafts.remove(id)
            return
        }
        if (value == known(subtask)) {
            // Already saved, or in flight: that rename settles the draft, and keeps it if it fails.
            if ((renaming[id] ?: 0) == 0) drafts.remove(id)
            return
        }
        sent[id] = value
        renaming[id] = (renaming[id] ?: 0) + 1
        run(Calls.renameSubtask(id, value)) { renamed ->
            renaming[id] = (renaming[id] ?: 1) - 1
            if (renamed) {
                if (drafts[id]?.trim() == value) drafts.remove(id)
            } else if (sent[id] == value) {
                sent.remove(id)
            }
        }
    }

    /** Saves every unfinished rename, for leaving the screen. */
    fun commitAll(subtasks: List<Subtask>) = subtasks.forEach(::commit)

    /** Forgets what was sent once the live title shows it, or changes with nothing in flight. */
    fun settle(subtask: Subtask) {
        val value = sent[subtask.id] ?: return
        if (subtask.title == value || (renaming[subtask.id] ?: 0) == 0) sent.remove(subtask.id)
    }
}

/** Subtasks: check off, rename inline, remove, and add at the bottom. */
fun LazyListScope.subtasksSection(
    subtasks: Live<List<Subtask>>,
    viewModel: TaskViewModel,
    enabled: Boolean,
) {
    item(key = "subtasks-header") {
        Text(
            "Subtasks",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp),
        )
    }
    when (subtasks) {
        is Live.Failed ->
            item(key = "subtasks-error") {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        subtasks.error.message ?: "Couldn't load subtasks.",
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = viewModel.subtasks::retry) { Text("Try Again") }
                }
            }
        is Live.Loaded -> {
            val rows = subtasks.value.sortedBy { it.position }
            if (rows.isEmpty()) {
                item(key = "subtasks-empty") {
                    Text(
                        "No subtasks yet.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            }
            items(rows, key = { it.id }) { subtask -> SubtaskRow(subtask, viewModel, enabled) }
        }
        Live.Loading -> {}
    }
    item(key = "subtasks-add") { AddSubtask(viewModel.subtaskEdits, enabled) }
}

@Composable
private fun AddSubtask(edits: SubtaskEdits, enabled: Boolean) {
    OutlinedTextField(
        value = edits.newTitle,
        onValueChange = edits::changeNewTitle,
        placeholder = { Text("Add a subtask") },
        enabled = enabled,
        singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { edits.add() }),
        modifier = Modifier.fillMaxWidth().padding(16.dp),
    )
}

@Composable
private fun SubtaskRow(subtask: Subtask, viewModel: TaskViewModel, enabled: Boolean) {
    val edits = viewModel.subtaskEdits
    var focused by remember { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    LaunchedEffect(subtask.title) { edits.settle(subtask) }

    ListItem(
        leadingContent = {
            Checkbox(
                checked = subtask.completed,
                onCheckedChange = { viewModel.run(Calls.setSubtaskCompleted(subtask.id, it)) },
                enabled = enabled,
                modifier = Modifier.semantics { contentDescription = subtask.title },
            )
        },
        trailingContent = {
            IconButton(
                onClick = { viewModel.run(Calls.removeSubtask(subtask.id)) },
                enabled = enabled,
            ) {
                Icon(Icons.Outlined.Close, contentDescription = "Delete Subtask")
            }
        },
    ) {
        TextField(
            value = edits.text(subtask),
            onValueChange = { edits.change(subtask, it) },
            enabled = enabled,
            singleLine = true,
            textStyle =
                MaterialTheme.typography.bodyLarge.copy(
                    textDecoration = if (subtask.completed) TextDecoration.LineThrough else null,
                    color =
                        if (subtask.completed) MaterialTheme.colorScheme.onSurfaceVariant
                        else MaterialTheme.colorScheme.onSurface,
                ),
            colors =
                TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    disabledContainerColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    disabledIndicatorColor = Color.Transparent,
                ),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
            modifier =
                Modifier.fillMaxWidth().onFocusChanged {
                    if (focused && !it.isFocused) edits.commit(subtask)
                    focused = it.isFocused
                },
        )
    }
}
