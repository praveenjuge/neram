package com.praveenjuge.neram.ui.projects

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Shuffle
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.praveenjuge.neram.data.Calls
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.model.OrganizationRole
import com.praveenjuge.neram.data.model.ProjectSummary
import com.praveenjuge.neram.data.prefixUtf16
import com.praveenjuge.neram.ui.common.ActionErrorDialog
import com.praveenjuge.neram.ui.common.ActionState
import com.praveenjuge.neram.ui.common.ConfirmDialog
import com.praveenjuge.neram.ui.common.ProjectBadge
import com.praveenjuge.neram.ui.common.ProjectStyle
import com.praveenjuge.neram.ui.common.rememberHoldingSheetState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** What the project editor is for. */
sealed interface EditorMode {
    data object Create : EditorMode

    data class Edit(val project: ProjectSummary) : EditorMode
}

/**
 * Creates, updates, and archives projects. Requests run in the owning view model's [scope], so
 * closing a sheet or leaving the screen never drops a result; [onDone] runs only on success.
 */
class ProjectActions(private val client: NeramClient, private val scope: CoroutineScope) {
    val action = ActionState()

    fun create(name: String, icon: String, color: String, onDone: (String) -> Unit) {
        scope.launch {
            var id: String? = null
            action.run { id = client.run(Calls.createProject(name, icon, color)) }
            id?.let(onDone)
        }
    }

    fun update(
        project: ProjectSummary,
        name: String,
        icon: String,
        color: String,
        onDone: () -> Unit,
    ) {
        scope.launch {
            if (action.run { client.run(Calls.updateProject(project.id, name, icon, color)) }) {
                onDone()
            }
        }
    }

    fun archive(project: ProjectSummary, onDone: () -> Unit = {}) {
        scope.launch { if (action.run { client.run(Calls.archiveProject(project.id)) }) onDone() }
    }
}

private const val NAME_LIMIT = 80

/**
 * Create or edit a project: name, color, and icon. Mirrors the web's NewProjectDialog and
 * EditProjectDialog. [onCreated] receives the new project's ID.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ProjectEditorSheet(
    mode: EditorMode,
    actions: ProjectActions,
    isConnected: Boolean,
    onDismiss: () -> Unit,
    onCreated: (String) -> Unit = {},
) {
    val editing = (mode as? EditorMode.Edit)?.project
    var name by rememberSaveable { mutableStateOf(editing?.name ?: "") }
    var icon by rememberSaveable {
        mutableStateOf(
            editing?.let { ProjectStyle.icon(it.icon).key } ?: ProjectStyle.icons.random().key
        )
    }
    var color by rememberSaveable {
        mutableStateOf(
            editing?.let { ProjectStyle.color(it.color).key } ?: ProjectStyle.colors.random().key
        )
    }
    var search by rememberSaveable { mutableStateOf("") }
    var confirmingArchive by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val sheet = rememberHoldingSheetState { actions.action.running }
    val trimmed = name.trim()
    val tint = ProjectStyle.color(color).color

    fun close() = scope.launch { sheet.hide() }.invokeOnCompletion { onDismiss() }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet) {
        Column(
            Modifier.fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onDismiss, enabled = !actions.action.running) {
                    Text("Cancel")
                }
                Text(
                    if (editing == null) "New Project" else "Edit Project",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                )
                Button(
                    enabled = trimmed.isNotEmpty() && !actions.action.running && isConnected,
                    onClick = {
                        if (editing == null) {
                            actions.create(trimmed, icon, color) {
                                close()
                                onCreated(it)
                            }
                        } else {
                            actions.update(editing, trimmed, icon, color) { close() }
                        }
                    },
                ) {
                    Text(if (editing == null) "Create" else "Save")
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                ProjectBadge(icon, color, size = 48.dp)
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text(
                        trimmed.ifEmpty { "Untitled project" },
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        "${ProjectStyle.color(color).label} · ${ProjectStyle.icon(icon).label}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (editing == null) {
                    IconButton(
                        onClick = {
                            icon = ProjectStyle.icons.random().key
                            color = ProjectStyle.colors.random().key
                        }
                    ) {
                        Icon(Icons.Outlined.Shuffle, contentDescription = "Shuffle")
                    }
                }
            }

            OutlinedTextField(
                value = name,
                onValueChange = { name = it.replace('\n', ' ').prefixUtf16(NAME_LIMIT) },
                label = { Text("Project name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            Text("Color", style = MaterialTheme.typography.titleSmall)
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                ProjectStyle.colors.forEach { option ->
                    Box(
                        Modifier.size(32.dp)
                            .background(option.color, CircleShape)
                            .clickable { color = option.key }
                            .semantics {
                                contentDescription = option.label
                                selected = option.key == color
                            },
                        Alignment.Center,
                    ) {
                        if (option.key == color) {
                            Icon(
                                Icons.Outlined.Check,
                                null,
                                tint = Color.White,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                    }
                }
            }

            Text("Icon", style = MaterialTheme.typography.titleSmall)
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                label = { Text("Search icons") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            val query = search.trim().lowercase()
            val matches =
                if (query.isEmpty()) ProjectStyle.icons
                else ProjectStyle.icons.filter { query in it.label }
            if (matches.isEmpty()) {
                Text(
                    "No icons match \"$search\"",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                matches.forEach { option ->
                    val chosen = option.key == icon
                    Box(
                        Modifier.size(40.dp)
                            .background(
                                if (chosen) tint.copy(alpha = 0.15f) else Color.Transparent,
                                RoundedCornerShape(10.dp),
                            )
                            .clickable { icon = option.key }
                            .semantics {
                                contentDescription = option.label
                                selected = chosen
                            },
                        Alignment.Center,
                    ) {
                        Icon(
                            option.vector,
                            contentDescription = null,
                            tint = if (chosen) tint else MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }

            if (editing != null && editing.role == OrganizationRole.Admin) {
                Column {
                    TextButton(onClick = { confirmingArchive = true }) {
                        Text("Archive Project", color = MaterialTheme.colorScheme.error)
                    }
                    Text(
                        "This hides the project from your dashboard. You can unarchive or " +
                            "permanently delete it later from Archived.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Box(Modifier.size(8.dp))
        }
    }

    if (confirmingArchive && editing != null) {
        ConfirmDialog(
            title = "Archive $trimmed?",
            message = "You can unarchive or permanently delete it later from Archived.",
            confirmLabel = "Archive",
            onConfirm = { actions.archive(editing) { close() } },
            onDismiss = { confirmingArchive = false },
        )
    }
    ActionErrorDialog(actions.action)
}
