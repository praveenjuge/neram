package com.praveenjuge.neram.ui.tasks

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.praveenjuge.neram.data.DueFilter
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.Queries
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.model.TaskItem
import com.praveenjuge.neram.ui.common.Live
import com.praveenjuge.neram.ui.common.LiveContent
import com.praveenjuge.neram.ui.common.LiveQuery
import com.praveenjuge.neram.ui.common.LocalIsConnected
import com.praveenjuge.neram.ui.common.LocalWorkspaceViewModelStoreOwner
import com.praveenjuge.neram.ui.common.TopLevelScreen
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/** Whose tasks My Tasks shows, like the web's Tasks page. */
enum class TaskScope(val label: String) {
    Mine("Mine"),
    Unassigned("Unassigned"),
    All("All"),
}

@HiltViewModel
class MyTasksViewModel @Inject constructor(client: NeramClient) : ViewModel() {
    // Only the shown scope's query stays subscribed.
    val mine = LiveQuery(viewModelScope) { client.observe(Queries.allTasks(assignedToMe = true)) }
    val everyone =
        LiveQuery(viewModelScope) { client.observe(Queries.allTasks(assignedToMe = false)) }
    val moves = TaskMoves(client, viewModelScope)

    var scope by mutableStateOf(TaskScope.Mine)
    var due by mutableStateOf(emptySet<DueFilter>())

    /** Unassigned narrows everyone's tasks; due chips combine with OR. */
    fun filter(tasks: List<TaskItem>): List<TaskItem> {
        val scoped =
            if (scope == TaskScope.Unassigned) tasks.filter { it.assigneeSubject == null }
            else tasks
        return DueFilter.apply(scoped, due)
    }

    fun clearFilters() {
        scope = TaskScope.Mine
        due = emptySet()
    }
}

/** Tasks across every project, filtered like the web's Tasks page. */
@Composable
fun MyTasksScreen(
    onOpenTask: (DocumentId) -> Unit,
    viewModel: MyTasksViewModel = hiltViewModel(LocalWorkspaceViewModelStoreOwner.current),
) {
    val query = if (viewModel.scope == TaskScope.Mine) viewModel.mine else viewModel.everyone
    val live by query.state.collectAsStateWithLifecycle()
    val isConnected = LocalIsConnected.current
    var creating by remember { mutableStateOf(false) }

    TopLevelScreen(
        "My Tasks",
        actions = {
            IconButton(onClick = { creating = true }, enabled = isConnected) {
                Icon(Icons.Outlined.Add, contentDescription = "New Task")
            }
        },
    ) { padding ->
        when (val state = live) {
            is Live.Loaded -> {
                val tasks = state.value
                TaskBoard(
                    tasks,
                    viewModel.moves,
                    onOpenTask,
                    padding,
                    showsProject = true,
                    emptyText =
                        if (viewModel.scope == TaskScope.Mine && tasks.isEmpty())
                            "Nothing is assigned to you yet."
                        else "Nothing here yet.",
                    filter = viewModel::filter,
                ) {
                    Filters(viewModel, viewModel.filter(viewModel.moves.apply(tasks)).size)
                }
            }
            // Keep the filters while a scope loads or fails (say it was never saved offline), so
            // switching back to one that works stays possible.
            else ->
                Column(Modifier.padding(padding)) {
                    Box(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                        Filters(viewModel, shownCount = null)
                    }
                    Box(Modifier.weight(1f)) {
                        LiveContent(state, PaddingValues(), query::retry) {}
                    }
                }
        }
    }

    if (creating) NewTaskSheet(projectId = null, isConnected, onDismiss = { creating = false })
}

@Composable
private fun Filters(viewModel: MyTasksViewModel, shownCount: Int?) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ChoiceButtons(
            TaskScope.entries,
            viewModel.scope,
            onSelect = { viewModel.scope = it },
            modifier = Modifier.fillMaxWidth(),
            label = { it.label },
        )
        // With large text the chips scroll sideways rather than run off-screen.
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            DueFilter.entries.forEach { filter ->
                val on = filter in viewModel.due
                FilterChip(
                    selected = on,
                    onClick = {
                        viewModel.due = if (on) viewModel.due - filter else viewModel.due + filter
                    },
                    label = { Text(filter.label) },
                )
            }
        }
        // Shown when any filter differs from the default, like the web.
        if (viewModel.due.isNotEmpty() || viewModel.scope != TaskScope.Mine) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    shownCount?.let { "$it shown" } ?: "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = viewModel::clearFilters) { Text("Clear") }
            }
        }
    }
}
