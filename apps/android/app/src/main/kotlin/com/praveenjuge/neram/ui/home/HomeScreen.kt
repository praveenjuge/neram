package com.praveenjuge.neram.ui.home

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.CreateNewFolder
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.Queries
import com.praveenjuge.neram.data.model.OrganizationRole
import com.praveenjuge.neram.data.model.ProjectSummary
import com.praveenjuge.neram.ui.common.ActionErrorDialog
import com.praveenjuge.neram.ui.common.ConfirmDialog
import com.praveenjuge.neram.ui.common.Live
import com.praveenjuge.neram.ui.common.LiveContent
import com.praveenjuge.neram.ui.common.LiveQuery
import com.praveenjuge.neram.ui.common.LocalIsConnected
import com.praveenjuge.neram.ui.common.LocalWorkspaceViewModelStoreOwner
import com.praveenjuge.neram.ui.common.ProjectBadge
import com.praveenjuge.neram.ui.common.TopLevelScreen
import com.praveenjuge.neram.ui.projects.EditorMode
import com.praveenjuge.neram.ui.projects.InviteSheet
import com.praveenjuge.neram.ui.projects.Invites
import com.praveenjuge.neram.ui.projects.ProjectActions
import com.praveenjuge.neram.ui.projects.ProjectEditorSheet
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(val client: NeramClient) : ViewModel() {
    val projects = LiveQuery(viewModelScope) { client.observe(Queries.projects) }
    val workspace = LiveQuery(viewModelScope) { client.observe(Queries.currentOrganization) }
    val actions = ProjectActions(client, viewModelScope)
    val invites = Invites(client, viewModelScope)
}

/** The dashboard: every active project, newest activity first. */
@Composable
fun HomeScreen(
    onOpenProject: (String) -> Unit,
    onOpenArchived: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(LocalWorkspaceViewModelStoreOwner.current),
) {
    val projects by viewModel.projects.state.collectAsStateWithLifecycle()
    val workspace by viewModel.workspace.state.collectAsStateWithLifecycle()
    val isAdmin = (workspace as? Live.Loaded)?.value?.isAdmin == true
    val isConnected = LocalIsConnected.current
    var editor by remember { mutableStateOf<EditorMode?>(null) }
    var inviting by remember { mutableStateOf(false) }
    var archiving by remember { mutableStateOf<ProjectSummary?>(null) }

    TopLevelScreen(
        "Projects",
        actions = {
            AddMenu(
                isAdmin = isAdmin,
                enabled = isConnected,
                onNewProject = { editor = EditorMode.Create },
                onShare = { inviting = true },
                onArchived = onOpenArchived,
            )
        },
    ) { padding ->
        LiveContent(projects, padding, viewModel.projects::retry) { list ->
            if (list.isEmpty()) {
                Column(
                    Modifier.fillMaxSize().padding(padding).padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("No projects yet", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Create your first project to open a kanban board.",
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Button(onClick = { editor = EditorMode.Create }, enabled = isConnected) {
                        Text("New Project")
                    }
                }
            } else {
                LazyColumn(contentPadding = padding) {
                    items(list, key = { it.id }) { project ->
                        ProjectRow(
                            project,
                            enabled = isConnected,
                            onOpen = { onOpenProject(project.id) },
                            onEdit = { editor = EditorMode.Edit(project) },
                            onArchive = { archiving = project },
                        )
                    }
                }
            }
        }
    }

    editor?.let { mode ->
        ProjectEditorSheet(
            mode = mode,
            actions = viewModel.actions,
            isConnected = isConnected,
            onDismiss = { editor = null },
            onCreated = onOpenProject,
        )
    }
    if (inviting) {
        InviteSheet(viewModel.invites, isConnected, onDismiss = { inviting = false })
    }
    archiving?.let { project ->
        ConfirmDialog(
            title = "Archive ${project.name}?",
            message =
                "This hides the project and its tasks from your dashboard. You can unarchive or " +
                    "permanently delete it later from Archived.",
            confirmLabel = "Archive",
            onConfirm = { viewModel.actions.archive(project) },
            onDismiss = { archiving = null },
        )
    }
    // The editor shows its own failures; archiving from the list shows them here.
    if (editor == null) ActionErrorDialog(viewModel.actions.action, "Couldn't archive the project")
}

@Composable
private fun AddMenu(
    isAdmin: Boolean,
    enabled: Boolean,
    onNewProject: () -> Unit,
    onShare: () -> Unit,
    onArchived: () -> Unit,
) {
    Box {
        var open by remember { mutableStateOf(false) }
        IconButton(onClick = { open = true }) {
            Icon(Icons.Outlined.Add, contentDescription = "Add")
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text("New Project") },
                leadingIcon = { Icon(Icons.Outlined.CreateNewFolder, null) },
                enabled = enabled,
                onClick = {
                    open = false
                    onNewProject()
                },
            )
            if (isAdmin) {
                DropdownMenuItem(
                    text = { Text("Share Projects") },
                    leadingIcon = { Icon(Icons.Outlined.PersonAdd, null) },
                    enabled = enabled,
                    onClick = {
                        open = false
                        onShare()
                    },
                )
                HorizontalDivider()
                DropdownMenuItem(
                    text = { Text("Archived Projects") },
                    leadingIcon = { Icon(Icons.Outlined.Archive, null) },
                    onClick = {
                        open = false
                        onArchived()
                    },
                )
            }
        }
    }
}

/** A project with its counts; long-press for Edit and (admins) Archive. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ProjectRow(
    project: ProjectSummary,
    enabled: Boolean,
    onOpen: () -> Unit,
    onEdit: () -> Unit,
    onArchive: () -> Unit,
) {
    Box {
        var menu by remember { mutableStateOf(false) }
        ListItem(
            modifier = Modifier.combinedClickable(onClick = onOpen, onLongClick = { menu = true }),
            leadingContent = { ProjectBadge(project.icon, project.color) },
            supportingContent = {
                Text(
                    "${project.todoCount.toInt()} Todo · " +
                        "${project.inProgressCount.toInt()} In Progress"
                )
            },
        ) {
            Text(project.name)
        }
        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
            DropdownMenuItem(
                text = { Text("Edit") },
                leadingIcon = { Icon(Icons.Outlined.Edit, null) },
                enabled = enabled,
                onClick = {
                    menu = false
                    onEdit()
                },
            )
            if (project.role == OrganizationRole.Admin) {
                DropdownMenuItem(
                    text = { Text("Archive") },
                    leadingIcon = { Icon(Icons.Outlined.Archive, null) },
                    enabled = enabled,
                    onClick = {
                        menu = false
                        onArchive()
                    },
                )
            }
        }
    }
}
