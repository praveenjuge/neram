package com.praveenjuge.neram.ui.focus

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Undo
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.praveenjuge.neram.data.Call
import com.praveenjuge.neram.data.Calls
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.PagedQuery
import com.praveenjuge.neram.data.Queries
import com.praveenjuge.neram.data.model.CurrentSprint
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.model.SprintDuration
import com.praveenjuge.neram.data.model.TaskStatus
import com.praveenjuge.neram.ui.common.ActionErrorDialog
import com.praveenjuge.neram.ui.common.ActionState
import com.praveenjuge.neram.ui.common.ConfirmDialog
import com.praveenjuge.neram.ui.common.Live
import com.praveenjuge.neram.ui.common.LiveContent
import com.praveenjuge.neram.ui.common.LiveQuery
import com.praveenjuge.neram.ui.common.LocalIsConnected
import com.praveenjuge.neram.ui.common.LocalWorkspaceViewModelStoreOwner
import com.praveenjuge.neram.ui.common.TopLevelScreen
import com.praveenjuge.neram.ui.tasks.NewTaskSheet
import com.praveenjuge.neram.ui.tasks.RowAction
import com.praveenjuge.neram.ui.tasks.TaskBoard
import com.praveenjuge.neram.ui.tasks.TaskMoves
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch

@HiltViewModel
class FocusViewModel @Inject constructor(private val client: NeramClient) : ViewModel() {
    val current = LiveQuery(viewModelScope) { client.observe(Queries.currentSprint) }
    val workspace = LiveQuery(viewModelScope) { client.observe(Queries.currentOrganization) }
    // Subscribed only while the Backlog picker shows it.
    val backlog = LiveQuery(viewModelScope) { client.observe(Queries.backlog) }
    val history = PagedQuery(pageSize = 10) { Queries.sprintHistory(it) }
    val moves = TaskMoves(client, viewModelScope)
    val action = ActionState()

    /** Keeps Sprint history live while the caller (the History sheet) runs. */
    suspend fun runHistory() = history.run(client)

    /**
     * Runs a change in this view model's scope, so closing a sheet never drops its result. [then]
     * gets whether it worked; failures show in [action].
     */
    fun run(call: Call<*>, then: (Boolean) -> Unit = {}) {
        viewModelScope.launch { then(action.run { client.run(call) }) }
    }
}

private enum class FocusSheet {
    Start,
    Goal,
    Duration,
    Backlog,
    History,
    NewTask,
}

/** The optional Sprint: one shared focus list across projects. */
@Composable
fun FocusScreen(
    onOpenTask: (DocumentId) -> Unit,
    viewModel: FocusViewModel = hiltViewModel(LocalWorkspaceViewModelStoreOwner.current),
) {
    val current by viewModel.current.state.collectAsStateWithLifecycle()
    val workspace by viewModel.workspace.state.collectAsStateWithLifecycle()
    val defaultDuration =
        (workspace as? Live.Loaded)?.value?.settings?.sprintDuration ?: SprintDuration.TwoWeeks
    val sprint = (current as? Live.Loaded)?.value
    val isConnected = LocalIsConnected.current
    var sheet by remember { mutableStateOf<FocusSheet?>(null) }
    var confirmingEnd by remember { mutableStateOf(false) }

    TopLevelScreen(
        "Focus",
        actions = {
            Box {
                var menu by remember { mutableStateOf(false) }
                IconButton(onClick = { menu = true }) {
                    Icon(Icons.Outlined.MoreVert, contentDescription = "Sprint options")
                }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    DropdownMenuItem(
                        text = { Text("History") },
                        leadingIcon = { Icon(Icons.Outlined.History, null) },
                        onClick = {
                            menu = false
                            sheet = FocusSheet.History
                        },
                    )
                    DropdownMenuItem(
                        text = { Text("Default Duration") },
                        leadingIcon = { Icon(Icons.Outlined.CalendarMonth, null) },
                        onClick = {
                            menu = false
                            sheet = FocusSheet.Duration
                        },
                    )
                }
            }
        },
    ) { padding ->
        LiveContent(current, padding, viewModel.current::retry) { value ->
            if (value == null) {
                NoSprint(padding, isConnected) { sheet = FocusSheet.Start }
            } else {
                ActiveSprint(
                    value,
                    viewModel,
                    padding,
                    isConnected,
                    onOpenTask,
                    onSheet = { sheet = it },
                    onEnd = { confirmingEnd = true },
                )
            }
        }
    }

    when (sheet) {
        FocusSheet.Start ->
            StartSprintSheet(viewModel, defaultDuration, isConnected) { sheet = null }
        FocusSheet.Goal ->
            SprintGoalSheet(viewModel, sprint?.sprint?.goal ?: "", isConnected) { sheet = null }
        FocusSheet.Duration ->
            SprintDurationSheet(viewModel, defaultDuration, isConnected) { sheet = null }
        FocusSheet.Backlog -> BacklogSheet(viewModel, isConnected) { sheet = null }
        FocusSheet.History -> SprintHistorySheet(viewModel, sprint) { sheet = null }
        FocusSheet.NewTask -> NewTaskSheet(null, isConnected, onDismiss = { sheet = null })
        null -> {}
    }
    if (confirmingEnd && sprint != null) {
        val open = viewModel.moves.apply(sprint.tasks).count { it.status != TaskStatus.Done }
        ConfirmDialog(
            title = "End this Sprint?",
            message =
                "The Sprint will be saved to History. $open unfinished " +
                    "task${if (open == 1) "" else "s"} will return to Backlog, and the next " +
                    "Sprint will start empty.",
            confirmLabel = "End Sprint",
            onConfirm = { viewModel.run(Calls.endSprint) },
            onDismiss = { confirmingEnd = false },
        )
    }
    ActionErrorDialog(viewModel.action)
}

@Composable
private fun NoSprint(padding: PaddingValues, enabled: Boolean, onStart: () -> Unit) {
    Box(Modifier.fillMaxSize().padding(padding).padding(24.dp), Alignment.Center) {
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Choose what matters now", style = MaterialTheme.typography.titleMedium)
            Text(
                "Start an optional Sprint with an empty focus list. Your projects and Backlog " +
                    "keep working even when no Sprint is active.",
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(onClick = onStart, enabled = enabled) { Text("Start a Sprint") }
        }
    }
}

@Composable
private fun ActiveSprint(
    current: CurrentSprint,
    viewModel: FocusViewModel,
    padding: PaddingValues,
    enabled: Boolean,
    onOpenTask: (DocumentId) -> Unit,
    onSheet: (FocusSheet) -> Unit,
    onEnd: () -> Unit,
) {
    val tasks = viewModel.moves.apply(current.tasks)
    val open = tasks.count { it.status != TaskStatus.Done }
    TaskBoard(
        current.tasks,
        viewModel.moves,
        onOpenTask,
        padding,
        statuses = listOf(TaskStatus.Todo, TaskStatus.InProgress),
        showsProject = true,
        emptyText =
            when {
                open > 0 -> "Nothing here yet."
                tasks.isEmpty() -> "Choose a few Backlog tasks to focus on."
                else -> "Everything in this Sprint is complete."
            },
        rowActions = { task ->
            listOf(
                RowAction("Return to Backlog", Icons.AutoMirrored.Outlined.Undo) {
                    viewModel.run(Calls.returnToBacklog(listOf(task.id)))
                }
            )
        },
        // Done work leaves the focus list; History shows it.
        filter = { list -> list.filter { it.status != TaskStatus.Done } },
    ) {
        SprintHeader(current, done = tasks.size - open, total = tasks.size, enabled, onSheet, onEnd)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SprintHeader(
    current: CurrentSprint,
    done: Int,
    total: Int,
    enabled: Boolean,
    onSheet: (FocusSheet) -> Unit,
    onEnd: () -> Unit,
) {
    val sprint = current.sprint
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "${sprint.dateRange()} · ${sprint.remaining()}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Column(Modifier.fillMaxWidth().clickable(enabled = enabled) { onSheet(FocusSheet.Goal) }) {
            Text(
                "Goal",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                sprint.goal ?: "Not set yet",
                color =
                    if (sprint.goal == null) MaterialTheme.colorScheme.onSurfaceVariant
                    else MaterialTheme.colorScheme.onSurface,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            LinearProgressIndicator(
                progress = { done.toFloat() / total.coerceAtLeast(1) },
                modifier = Modifier.fillMaxWidth(),
            )
            Text("$done of $total completed", style = MaterialTheme.typography.labelMedium)
        }
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedButton(onClick = { onSheet(FocusSheet.NewTask) }, enabled = enabled) {
                Text("Add Task")
            }
            OutlinedButton(onClick = { onSheet(FocusSheet.Backlog) }, enabled = enabled) {
                Text("Add from Backlog")
            }
            TextButton(
                onClick = onEnd,
                enabled = enabled,
                colors =
                    ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
            ) {
                Text("End Sprint")
            }
        }
    }
}
