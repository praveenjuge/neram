package com.praveenjuge.neram.ui.projects

import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.Queries
import com.praveenjuge.neram.data.model.TaskStatus
import com.praveenjuge.neram.ui.common.DetailScreen
import com.praveenjuge.neram.ui.common.Live
import com.praveenjuge.neram.ui.common.LiveContent
import com.praveenjuge.neram.ui.common.LiveQuery
import com.praveenjuge.neram.ui.common.LocalIsConnected
import com.praveenjuge.neram.ui.common.Message
import com.praveenjuge.neram.ui.tasks.TaskListItem
import dagger.assisted.Assisted
import dagger.assisted.AssistedFactory
import dagger.assisted.AssistedInject
import dagger.hilt.android.lifecycle.HiltViewModel

@HiltViewModel(assistedFactory = ProjectViewModel.Factory::class)
class ProjectViewModel
@AssistedInject
constructor(@Assisted projectId: String, client: NeramClient) : ViewModel() {
    val project = LiveQuery(viewModelScope) { client.observe(Queries.project(projectId)) }
    val tasks = LiveQuery(viewModelScope) { client.observe(Queries.tasks(projectId)) }
    val actions = ProjectActions(client, viewModelScope)

    @AssistedFactory
    interface Factory {
        fun create(projectId: String): ProjectViewModel
    }
}

/** A project and its tasks. The kanban board replaces this list in the next step. */
@Composable
fun ProjectScreen(
    projectId: String,
    onBack: () -> Unit,
    viewModel: ProjectViewModel =
        hiltViewModel<ProjectViewModel, ProjectViewModel.Factory> { it.create(projectId) },
) {
    val project by viewModel.project.state.collectAsStateWithLifecycle()
    val tasks by viewModel.tasks.state.collectAsStateWithLifecycle()
    val summary = (project as? Live.Loaded)?.value
    val isConnected = LocalIsConnected.current
    var editing by remember { mutableStateOf(false) }

    DetailScreen(
        summary?.name ?: "",
        onBack,
        actions = {
            if (summary != null) {
                IconButton(onClick = { editing = true }, enabled = isConnected) {
                    Icon(Icons.Outlined.Edit, contentDescription = "Edit Project")
                }
            }
        },
    ) { padding ->
        LiveContent(project, padding, viewModel.project::retry) { loaded ->
            if (loaded == null) {
                Message(
                    padding,
                    "Project not found",
                    "It may have been archived or removed, or the link is incorrect.",
                )
            } else {
                LiveContent(tasks, padding, viewModel.tasks::retry) { list ->
                    if (list.isEmpty()) {
                        Message(padding, "No tasks yet", "Tasks in this project show up here.")
                    } else {
                        val ordered =
                            list.sortedWith(
                                compareBy(
                                    { TaskStatus.entries.indexOf(it.status) },
                                    { it.position },
                                )
                            )
                        LazyColumn(contentPadding = padding) {
                            items(ordered, key = { it.id }) { task -> TaskListItem(task) }
                        }
                    }
                }
            }
        }
    }

    if (editing && summary != null) {
        ProjectEditorSheet(
            mode = EditorMode.Edit(summary),
            actions = viewModel.actions,
            isConnected = isConnected,
            onDismiss = { editing = false },
        )
    }
}
