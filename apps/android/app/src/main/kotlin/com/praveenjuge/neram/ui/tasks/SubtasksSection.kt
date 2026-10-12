package com.praveenjuge.neram.ui.tasks

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
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.praveenjuge.neram.data.Calls
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.model.Subtask
import com.praveenjuge.neram.data.prefixUtf16
import com.praveenjuge.neram.ui.common.Live

private const val SUBTASK_LIMIT = 200

/** Subtasks: check off, rename inline, remove, and add at the bottom. */
fun LazyListScope.subtasksSection(
    taskId: DocumentId,
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
    val rows = (subtasks as? Live.Loaded)?.value?.sortedBy { it.position }
    if (rows != null && rows.isEmpty()) {
        item(key = "subtasks-empty") {
            Text(
                "No subtasks yet.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(16.dp),
            )
        }
    }
    items(rows.orEmpty(), key = { it.id }) { subtask -> SubtaskRow(subtask, viewModel, enabled) }
    item(key = "subtasks-add") { AddSubtask(taskId, viewModel, enabled) }
}

/**
 * Keeps the typed title until the server accepts it, so a failed add can be retried without
 * retyping.
 */
@Composable
private fun AddSubtask(taskId: DocumentId, viewModel: TaskViewModel, enabled: Boolean) {
    var title by rememberSaveable { mutableStateOf("") }
    var adding by remember { mutableStateOf(false) }
    fun add() {
        val value = title.trim()
        if (value.isEmpty() || adding) return
        adding = true
        viewModel.run(Calls.createSubtask(taskId, value)) { added ->
            if (added && title.trim() == value) title = ""
            adding = false
        }
    }
    OutlinedTextField(
        value = title,
        onValueChange = { title = it.replace('\n', ' ').prefixUtf16(SUBTASK_LIMIT) },
        placeholder = { Text("Add a subtask") },
        enabled = enabled,
        singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { add() }),
        modifier = Modifier.fillMaxWidth().padding(16.dp),
    )
}

/**
 * One subtask. Renames compare against the latest title sent, so a quick change back is saved too.
 * The draft stays until its rename succeeds; after a failure, leaving the field again retries it.
 */
@Composable
private fun SubtaskRow(subtask: Subtask, viewModel: TaskViewModel, enabled: Boolean) {
    var draft by remember { mutableStateOf<String?>(null) }
    /** The latest title this row sent, until the live subtask shows it. */
    var sent by remember { mutableStateOf<String?>(null) }
    var renaming by remember { mutableIntStateOf(0) }
    var focused by remember { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val known = sent ?: subtask.title
    // Forget what we sent once the live title changes to it, or changes with nothing in flight.
    LaunchedEffect(subtask.title) { if (subtask.title == sent || renaming == 0) sent = null }

    fun commit() {
        val value = draft?.trim() ?: return
        if (value.isEmpty()) {
            draft = null
            return
        }
        if (value == known) {
            // Already saved, or in flight: that rename settles the draft, and keeps it if it fails.
            if (renaming == 0) draft = null
            return
        }
        sent = value
        renaming += 1
        viewModel.run(Calls.renameSubtask(subtask.id, value)) { renamed ->
            renaming -= 1
            if (renamed) {
                if (draft?.trim() == value) draft = null
            } else if (sent == value) {
                sent = null
            }
        }
    }

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
            value = draft ?: known,
            onValueChange = { draft = it.replace('\n', ' ').prefixUtf16(SUBTASK_LIMIT) },
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
                    if (focused && !it.isFocused) commit()
                    focused = it.isFocused
                },
        )
    }
}
