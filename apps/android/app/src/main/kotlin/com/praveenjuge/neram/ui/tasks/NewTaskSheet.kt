package com.praveenjuge.neram.ui.tasks

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.clerk.api.Clerk
import com.praveenjuge.neram.data.Calls
import com.praveenjuge.neram.data.DueDate
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.PagedQuery
import com.praveenjuge.neram.data.Queries
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.prefixUtf16
import com.praveenjuge.neram.ui.common.ActionErrorDialog
import com.praveenjuge.neram.ui.common.ActionState
import com.praveenjuge.neram.ui.common.Live
import com.praveenjuge.neram.ui.common.LiveQuery
import com.praveenjuge.neram.ui.common.rememberHoldingSheetState
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch

private const val TITLE_LIMIT = 120
private const val DESCRIPTION_LIMIT = 2000

@HiltViewModel
class NewTaskViewModel @Inject constructor(private val client: NeramClient) : ViewModel() {
    val projects = LiveQuery(viewModelScope) { client.observe(Queries.projectNames) }
    val members = PagedQuery(pageSize = 100, loadsAllPages = true) { Queries.members(it) }
    val action = ActionState()

    init {
        viewModelScope.launch { members.run(client) }
    }

    /** Runs here so closing the sheet or leaving the screen never drops the result. */
    fun create(
        projectId: DocumentId,
        title: String,
        description: String?,
        dueDate: String?,
        assignee: String?,
        onDone: () -> Unit,
    ) {
        viewModelScope.launch {
            val created = action.run {
                client.run(Calls.createTask(projectId, title, description, dueDate, assignee))
            }
            if (created) onDone()
        }
    }
}

/**
 * New task: title and project, plus an optional description, due date, and assignee. New tasks
 * start in Todo, as on the web. [projectId] preselects a project.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewTaskSheet(
    projectId: DocumentId?,
    isConnected: Boolean,
    onDismiss: () -> Unit,
    viewModel: NewTaskViewModel = hiltViewModel(),
) {
    val projects by viewModel.projects.state.collectAsStateWithLifecycle()
    val members by viewModel.members.state.collectAsStateWithLifecycle()
    val names = (projects as? Live.Loaded)?.value.orEmpty()
    var title by rememberSaveable { mutableStateOf("") }
    var selected by rememberSaveable { mutableStateOf(projectId) }
    var description by rememberSaveable { mutableStateOf("") }
    var dueDate by rememberSaveable { mutableStateOf<String?>(null) }
    var assignee by rememberSaveable { mutableStateOf("") }
    var showsDetails by rememberSaveable { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val sheet = rememberHoldingSheetState { viewModel.action.running }
    val trimmed = title.trim()

    LaunchedEffect(names) { if (selected == null) selected = names.firstOrNull()?.id }

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
                TextButton(onClick = ::close, enabled = !viewModel.action.running) {
                    Text("Cancel")
                }
                Text(
                    "New Task",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                )
                Button(
                    enabled =
                        trimmed.isNotEmpty() &&
                            selected != null &&
                            !viewModel.action.running &&
                            isConnected,
                    onClick = {
                        val project = selected ?: return@Button
                        val details = description.trim()
                        viewModel.create(
                            project,
                            trimmed,
                            details.ifEmpty { null },
                            dueDate,
                            assignee.ifEmpty { null },
                        ) {
                            close()
                        }
                    },
                ) {
                    Text("Create")
                }
            }
            OutlinedTextField(
                value = title,
                onValueChange = { title = it.replace('\n', ' ').prefixUtf16(TITLE_LIMIT) },
                label = { Text("Task title") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            ProjectPicker(
                selected = selected,
                projects = names,
                onSelect = { selected = it },
                enabled = true,
            )
            Text(
                "New tasks start in the Todo column of the chosen project.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (showsDetails) {
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it.prefixUtf16(DESCRIPTION_LIMIT) },
                    label = { Text("Description") },
                    placeholder = { Text("Add more detail") },
                    minLines = 3,
                    maxLines = 8,
                    modifier = Modifier.fillMaxWidth(),
                )
                DueDateField(
                    date = DueDate.parse(dueDate),
                    onChange = { dueDate = it?.let(DueDate::format) },
                    enabled = true,
                )
                AssigneePicker(
                    selected = assignee,
                    members = members.items,
                    currentUserId = Clerk.user?.id,
                    onSelect = { assignee = it },
                    enabled = true,
                )
            } else {
                TextButton(onClick = { showsDetails = true }) {
                    Icon(Icons.Outlined.Add, contentDescription = null)
                    Text("Add Details", modifier = Modifier.padding(start = 8.dp))
                }
            }
        }
    }
    ActionErrorDialog(viewModel.action, "Couldn't create the task")
}
