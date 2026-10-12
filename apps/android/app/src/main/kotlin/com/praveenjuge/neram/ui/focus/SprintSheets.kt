package com.praveenjuge.neram.ui.focus

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.praveenjuge.neram.data.Calls
import com.praveenjuge.neram.data.PagedQuery
import com.praveenjuge.neram.data.model.CurrentSprint
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.model.SprintDuration
import com.praveenjuge.neram.data.model.TaskItem
import com.praveenjuge.neram.data.model.TaskStatus
import com.praveenjuge.neram.data.prefixUtf16
import com.praveenjuge.neram.ui.common.Live
import com.praveenjuge.neram.ui.common.LiveContent
import com.praveenjuge.neram.ui.common.pageFooter
import com.praveenjuge.neram.ui.common.rememberHoldingSheetState
import com.praveenjuge.neram.ui.tasks.TaskRow
import kotlinx.coroutines.launch

private const val GOAL_LIMIT = 500

/**
 * A sheet with Cancel, a title, and an optional confirm button. It stays open while [running], and
 * [content] gets a `close` that hides it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SprintSheet(
    title: String,
    running: Boolean,
    onDismiss: () -> Unit,
    confirm: (@Composable (close: () -> Unit) -> Unit)? = null,
    content: @Composable ColumnScope.(close: () -> Unit) -> Unit,
) {
    val sheet = rememberHoldingSheetState { running }
    val scope = rememberCoroutineScope()
    val close: () -> Unit = { scope.launch { sheet.hide() }.invokeOnCompletion { onDismiss() } }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 20.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = close, enabled = !running) {
                    Text(if (confirm == null) "Done" else "Cancel")
                }
                Text(
                    title,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                )
                confirm?.invoke(close)
            }
            content(close)
        }
    }
}

private val SprintDuration.choiceLabel: String
    get() = if (this == SprintDuration.Open) "No fixed end date" else label

@Composable
private fun DurationChoice(selected: SprintDuration?, onSelect: (SprintDuration) -> Unit) {
    Column(Modifier.selectableGroup()) {
        SprintDuration.entries.forEach { duration ->
            Row(
                Modifier.fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .selectable(
                        selected = duration == selected,
                        onClick = { onSelect(duration) },
                        role = Role.RadioButton,
                    ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RadioButton(selected = duration == selected, onClick = null)
                Text(duration.choiceLabel, modifier = Modifier.padding(start = 12.dp))
            }
        }
    }
}

@Composable
fun StartSprintSheet(
    viewModel: FocusViewModel,
    /** The workspace's saved duration, or null while it loads. */
    defaultDuration: SprintDuration?,
    isConnected: Boolean,
    onDismiss: () -> Unit,
) {
    var goal by rememberSaveable { mutableStateOf("") }
    var duration by rememberSaveable { mutableStateOf<SprintDuration?>(null) }
    val running = viewModel.action.running
    SprintSheet(
        "Start a Sprint",
        running,
        onDismiss,
        confirm = { close ->
            Button(
                enabled = !running && isConnected,
                onClick = {
                    val trimmed = goal.trim()
                    viewModel.run(
                        // Without a pick, the server applies the workspace's saved duration.
                        Calls.startSprint(trimmed.ifEmpty { null }, duration)
                    ) { started ->
                        if (started) close()
                    }
                },
            ) {
                Text("Start")
            }
        },
    ) {
        OutlinedTextField(
            value = goal,
            onValueChange = { goal = it.prefixUtf16(GOAL_LIMIT) },
            label = { Text("Goal (optional)") },
            placeholder = { Text("What outcome matters most?") },
            minLines = 2,
            modifier = Modifier.fillMaxWidth(),
        )
        DurationChoice(duration ?: defaultDuration) { duration = it }
    }
}

@Composable
fun SprintGoalSheet(
    viewModel: FocusViewModel,
    goal: String,
    isConnected: Boolean,
    onDismiss: () -> Unit,
) {
    var draft by rememberSaveable { mutableStateOf(goal) }
    val running = viewModel.action.running
    SprintSheet(
        "Sprint Goal",
        running,
        onDismiss,
        confirm = { close ->
            Button(
                enabled = !running && isConnected,
                onClick = {
                    val value = draft.trim()
                    viewModel.run(Calls.updateSprintGoal(value.ifEmpty { null })) { saved ->
                        if (saved) close()
                    }
                },
            ) {
                Text("Save")
            }
        },
    ) {
        OutlinedTextField(
            value = draft,
            onValueChange = { draft = it.prefixUtf16(GOAL_LIMIT) },
            label = { Text("Goal") },
            placeholder = { Text("What outcome matters most?") },
            minLines = 2,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
fun SprintDurationSheet(
    viewModel: FocusViewModel,
    current: SprintDuration,
    isConnected: Boolean,
    onDismiss: () -> Unit,
) {
    // Only a change is kept, so the sheet always starts from the latest saved duration.
    var selection by rememberSaveable { mutableStateOf<SprintDuration?>(null) }
    val running = viewModel.action.running
    SprintSheet(
        "Default Duration",
        running,
        onDismiss,
        confirm = { close ->
            Button(
                enabled = !running && isConnected,
                onClick = {
                    viewModel.run(Calls.updateSprintDuration(selection ?: current)) { saved ->
                        if (saved) close()
                    }
                },
            ) {
                Text("Save")
            }
        },
    ) {
        DurationChoice(selection ?: current) { selection = it }
        Text(
            "Applied when the next Sprint starts. The active Sprint does not change.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** "Add focused work": pick Backlog tasks, grouped by project. */
@Composable
fun BacklogSheet(viewModel: FocusViewModel, isConnected: Boolean, onDismiss: () -> Unit) {
    val backlog by viewModel.backlog.state.collectAsStateWithLifecycle()
    var search by rememberSaveable { mutableStateOf("") }
    var selected by remember { mutableStateOf(emptySet<DocumentId>()) }
    val running = viewModel.action.running
    // Drop picks that left the Backlog (planned, completed, or deleted elsewhere); search only
    // hides rows, so it keeps them.
    LaunchedEffect(backlog) {
        (backlog as? Live.Loaded)?.value?.let { tasks ->
            selected = selected intersect tasks.map { it.id }.toSet()
        }
    }
    SprintSheet(
        "Add Focused Work",
        running,
        onDismiss,
        confirm = { close ->
            val count = selected.size
            Button(
                enabled = count > 0 && !running && isConnected,
                onClick = {
                    viewModel.run(Calls.planSprint(selected.toList())) { added ->
                        if (added) close()
                    }
                },
            ) {
                Text("Add $count")
            }
        },
    ) {
        OutlinedTextField(
            value = search,
            onValueChange = { search = it },
            placeholder = { Text("Search Backlog") },
            leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        LiveContent(backlog, PaddingValues(), viewModel.backlog::retry) { tasks ->
            val groups = grouped(tasks, search)
            LazyColumn(Modifier.fillMaxWidth().heightIn(max = 480.dp)) {
                if (groups.isEmpty()) {
                    item {
                        Text(
                            if (tasks.isEmpty()) "Backlog is empty."
                            else "No matching Backlog tasks.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(vertical = 16.dp),
                        )
                    }
                }
                groups.forEach { (project, rows) ->
                    item(key = "project-$project") {
                        Text(
                            project,
                            style = MaterialTheme.typography.titleSmall,
                            modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
                        )
                    }
                    items(rows, key = { it.id }) { task ->
                        val checked = task.id in selected
                        ListItem(
                            modifier =
                                Modifier.toggleable(
                                    value = checked,
                                    role = Role.Checkbox,
                                    onValueChange = {
                                        selected =
                                            if (checked) selected - task.id else selected + task.id
                                    },
                                ),
                            leadingContent = {
                                Checkbox(checked = checked, onCheckedChange = null)
                            },
                        ) {
                            Text(task.title)
                        }
                    }
                }
            }
        }
    }
}

/** Matching Backlog tasks by project name, each in board order. */
private fun grouped(tasks: List<TaskItem>, search: String): List<Pair<String, List<TaskItem>>> {
    val query = search.trim().lowercase()
    return tasks
        .filter {
            query.isEmpty() || "${it.title} ${it.projectName ?: ""}".lowercase().contains(query)
        }
        .groupBy { it.projectName ?: "" }
        .map { (name, rows) -> name to rows.sortedBy { it.position } }
        .sortedBy { it.first }
}

/** Completed work in the current Sprint, then closed Sprints. */
@Composable
fun SprintHistorySheet(viewModel: FocusViewModel, current: CurrentSprint?, onDismiss: () -> Unit) {
    LaunchedEffect(Unit) { viewModel.runHistory() }
    val history by viewModel.history.state.collectAsStateWithLifecycle()
    val completed =
        current?.let { viewModel.moves.apply(it.tasks) }?.filter { it.status == TaskStatus.Done }
            ?: emptyList()
    SprintSheet("Sprint History", running = false, onDismiss) {
        LazyColumn(Modifier.fillMaxWidth().heightIn(max = 560.dp)) {
            if (completed.isNotEmpty()) {
                item { SectionTitle("Completed this Sprint") }
                items(completed, key = { it.id }) { TaskRow(it, showsProject = true) }
            }
            item { SectionTitle("Closed Sprints") }
            if (
                history.status == PagedQuery.Status.Exhausted &&
                    history.items.isEmpty() &&
                    completed.isEmpty()
            ) {
                item {
                    Text(
                        "No completed work or closed Sprints yet.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            items(history.items, key = { it.id }) { sprint ->
                val total = sprint.baselineCount?.toInt() ?: 0
                val done = sprint.completedCount?.toInt() ?: 0
                Column(Modifier.padding(vertical = 8.dp)) {
                    Row {
                        Text(sprint.dateRange(), modifier = Modifier.weight(1f))
                        Text(
                            "$done of $total",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    sprint.goal?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                    Text(
                        if (done >= total) "All committed work completed"
                        else "${total - done} unfinished",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                HorizontalDivider()
            }
            pageFooter(
                history,
                viewModel.history::loadMore,
                "Older Sprints load when you're back online.",
            )
            history.error?.let { error ->
                if (history.items.isEmpty()) {
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                error.message ?: "Couldn't load Sprint history.",
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.weight(1f),
                            )
                            TextButton(onClick = viewModel.history::retry) { Text("Try Again") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleSmall,
        modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
    )
}
