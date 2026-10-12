package com.praveenjuge.neram.ui.projects

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Unarchive
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.praveenjuge.neram.data.Calls
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.PagedQuery
import com.praveenjuge.neram.data.Queries
import com.praveenjuge.neram.data.model.ProjectSummary
import com.praveenjuge.neram.ui.common.ActionErrorDialog
import com.praveenjuge.neram.ui.common.ActionState
import com.praveenjuge.neram.ui.common.ConfirmDialog
import com.praveenjuge.neram.ui.common.DetailScreen
import com.praveenjuge.neram.ui.common.LocalIsConnected
import com.praveenjuge.neram.ui.common.Message
import com.praveenjuge.neram.ui.common.ProjectBadge
import com.praveenjuge.neram.ui.common.pageFooter
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch

@HiltViewModel
class ArchivedProjectsViewModel @Inject constructor(private val client: NeramClient) : ViewModel() {
    private val archived = PagedQuery(pageSize = 30) { Queries.archivedProjects(it) }
    val state = archived.state
    val action = ActionState()

    init {
        viewModelScope.launch { archived.run(client) }
    }

    fun loadMore() = archived.loadMore()

    fun retry() = archived.retry()

    suspend fun unarchive(project: ProjectSummary) = action.run {
        client.run(Calls.unarchiveProject(project.id))
    }

    suspend fun delete(project: ProjectSummary) = action.run {
        client.run(Calls.removeProject(project.id))
    }
}

/** Archived projects (admins only): unarchive or permanently delete. */
@Composable
fun ArchivedProjectsScreen(
    onBack: () -> Unit,
    viewModel: ArchivedProjectsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val isConnected = LocalIsConnected.current
    var deleting by remember { mutableStateOf<ProjectSummary?>(null) }
    val scope = rememberCoroutineScope()

    DetailScreen("Archived", onBack) { padding ->
        val error = state.error
        when {
            error != null && state.items.isEmpty() ->
                Message(
                    padding,
                    "Couldn't load archived projects",
                    error.message ?: "Something went wrong.",
                    viewModel::retry,
                )
            state.status == PagedQuery.Status.LoadingFirstPage ->
                Box(Modifier.fillMaxWidth().padding(padding).padding(24.dp), Alignment.Center) {
                    CircularProgressIndicator()
                }
            state.items.isEmpty() ->
                Message(
                    padding,
                    "No archived projects",
                    "Archive a project from its menu to tuck it away here.",
                )
            else ->
                LazyColumn(contentPadding = padding) {
                    items(state.items, key = { it.id }) { project ->
                        ListItem(
                            leadingContent = { ProjectBadge(project.icon, project.color) },
                            supportingContent = {
                                Text(
                                    "${project.todoCount.toInt()} Todo · " +
                                        "${project.inProgressCount.toInt()} In Progress · " +
                                        "${project.doneCount.toInt()} Done"
                                )
                            },
                            trailingContent = {
                                Box {
                                    var menu by remember { mutableStateOf(false) }
                                    IconButton(onClick = { menu = true }, enabled = isConnected) {
                                        Icon(Icons.Outlined.MoreVert, contentDescription = "More")
                                    }
                                    DropdownMenu(
                                        expanded = menu,
                                        onDismissRequest = { menu = false },
                                    ) {
                                        DropdownMenuItem(
                                            text = { Text("Unarchive") },
                                            leadingIcon = { Icon(Icons.Outlined.Unarchive, null) },
                                            onClick = {
                                                menu = false
                                                scope.launch { viewModel.unarchive(project) }
                                            },
                                        )
                                        DropdownMenuItem(
                                            text = { Text("Delete") },
                                            leadingIcon = { Icon(Icons.Outlined.Delete, null) },
                                            onClick = {
                                                menu = false
                                                deleting = project
                                            },
                                        )
                                    }
                                }
                            },
                        ) {
                            Text(project.name)
                        }
                    }
                    pageFooter(state, viewModel::loadMore, "More archived projects load online.")
                }
        }
    }

    deleting?.let { project ->
        ConfirmDialog(
            title = "Delete ${project.name}?",
            message =
                "This permanently deletes the project and all of its tasks. This can't be undone.",
            confirmLabel = "Delete Project",
            onConfirm = { scope.launch { viewModel.delete(project) } },
            onDismiss = { deleting = null },
        )
    }
    ActionErrorDialog(viewModel.action)
}
