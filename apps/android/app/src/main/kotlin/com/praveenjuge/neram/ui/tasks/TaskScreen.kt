package com.praveenjuge.neram.ui.tasks

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.clerk.api.Clerk
import com.praveenjuge.neram.data.Call
import com.praveenjuge.neram.data.Calls
import com.praveenjuge.neram.data.DueDate
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.PagedQuery
import com.praveenjuge.neram.data.Queries
import com.praveenjuge.neram.data.model.TaskItem
import com.praveenjuge.neram.data.model.convexInstant
import com.praveenjuge.neram.data.prefixUtf16
import com.praveenjuge.neram.ui.common.ActionErrorDialog
import com.praveenjuge.neram.ui.common.ActionState
import com.praveenjuge.neram.ui.common.ConfirmDialog
import com.praveenjuge.neram.ui.common.DetailScreen
import com.praveenjuge.neram.ui.common.Live
import com.praveenjuge.neram.ui.common.LiveContent
import com.praveenjuge.neram.ui.common.LiveQuery
import com.praveenjuge.neram.ui.common.LocalIsConnected
import com.praveenjuge.neram.ui.common.Message
import dagger.assisted.Assisted
import dagger.assisted.AssistedFactory
import dagger.assisted.AssistedInject
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.launch

private const val TITLE_LIMIT = 120
private const val DESCRIPTION_LIMIT = 2000

@HiltViewModel(assistedFactory = TaskViewModel.Factory::class)
class TaskViewModel
@AssistedInject
constructor(@Assisted private val taskId: String, private val client: NeramClient) : ViewModel() {
    val task = LiveQuery(viewModelScope) { client.observe(Queries.task(taskId)) }
    val projects = LiveQuery(viewModelScope) { client.observe(Queries.projectNames) }
    val subtasks = LiveQuery(viewModelScope) { client.observe(Queries.subtasks(taskId)) }
    val members = PagedQuery(pageSize = 100, loadsAllPages = true) { Queries.members(it) }
    val moves = TaskMoves(client, viewModelScope)
    val action = ActionState()

    val title =
        EditableField(
            action,
            allowsEmpty = false,
            normalize = { it.replace('\n', ' ').prefixUtf16(TITLE_LIMIT) },
        ) { value, expected ->
            client.run(Calls.updateTask(taskId, title = value, expectedTitle = expected))
        }

    val description =
        EditableField(
            action,
            allowsEmpty = true,
            normalize = { it.prefixUtf16(DESCRIPTION_LIMIT) },
        ) { value, expected ->
            client.run(
                Calls.updateTask(
                    taskId,
                    description = value,
                    expectedDescription =
                        if (expected.isEmpty()) Calls.ExpectedDescription.Empty
                        else Calls.ExpectedDescription.Text(expected),
                )
            )
        }

    init {
        viewModelScope.launch { members.run(client) }
    }

    /** Saves a finished edit; runs here so leaving the screen doesn't cancel it. */
    fun commit(field: EditableField) = field.commit(viewModelScope)

    fun keepMine(field: EditableField) = field.keepMine(viewModelScope)

    /** Runs a one-off change; failures show in [action]. Calls [then] with whether it worked. */
    fun run(call: Call<*>, then: (Boolean) -> Unit = {}) {
        viewModelScope.launch { then(action.run { client.run(call) }) }
    }

    @AssistedFactory
    interface Factory {
        fun create(taskId: String): TaskViewModel
    }
}

/**
 * A task's details. Title and description save when editing finishes; a newer edit by someone else
 * surfaces as a conflict to resolve, like the web's task dialog.
 */
@Composable
fun TaskScreen(
    taskId: String,
    onBack: () -> Unit,
    viewModel: TaskViewModel =
        hiltViewModel<TaskViewModel, TaskViewModel.Factory> { it.create(taskId) },
) {
    val live by viewModel.task.state.collectAsStateWithLifecycle()
    var confirmingDelete by remember { mutableStateOf(false) }
    val current = (live as? Live.Loaded)?.value
    val enabled = LocalIsConnected.current

    DetailScreen(
        "Task",
        onBack,
        actions = {
            if (current != null) {
                Box {
                    var menu by remember { mutableStateOf(false) }
                    IconButton(onClick = { menu = true }) {
                        Icon(Icons.Outlined.MoreVert, contentDescription = "More")
                    }
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        DropdownMenuItem(
                            text = { Text("Delete Task…") },
                            leadingIcon = { Icon(Icons.Outlined.Delete, null) },
                            enabled = enabled,
                            onClick = {
                                menu = false
                                confirmingDelete = true
                            },
                        )
                    }
                }
            }
        },
    ) { padding ->
        LiveContent(live, padding, viewModel.task::retry) { value ->
            LaunchedEffect(value) {
                viewModel.moves.reconcile(listOfNotNull(value))
                value?.let {
                    viewModel.title.settle(it.title)
                    viewModel.description.settle(it.description ?: "")
                }
            }
            val task = value?.let { viewModel.moves.apply(listOf(it)).first() }
            if (task == null) {
                Message(
                    padding,
                    "Task unavailable",
                    "It was deleted, moved somewhere you cannot access, or the link is invalid.",
                )
            } else {
                TaskForm(task, viewModel, padding, enabled)
            }
        }
    }

    if (confirmingDelete && current != null) {
        ConfirmDialog(
            title =
                "Delete this task, ${current.totalSubtasks.toInt()} subtasks, and " +
                    "${current.activeCommentCount.toInt()} active comments?",
            message = "This can't be undone.",
            confirmLabel = "Delete Task",
            onConfirm = {
                viewModel.run(Calls.removeTask(current.id, confirmCascade = true)) { deleted ->
                    if (deleted) onBack()
                }
            },
            onDismiss = { confirmingDelete = false },
        )
    }
    TaskMoveDialogs(viewModel.moves)
    ActionErrorDialog(viewModel.action)
}

@Composable
private fun TaskForm(
    task: TaskItem,
    viewModel: TaskViewModel,
    padding: PaddingValues,
    enabled: Boolean,
) {
    val projects by viewModel.projects.state.collectAsStateWithLifecycle()
    val members by viewModel.members.state.collectAsStateWithLifecycle()
    val subtasks by viewModel.subtasks.state.collectAsStateWithLifecycle()
    val focus = LocalFocusManager.current

    // Edge to edge, the keyboard draws over the screen: pad for it so focused fields scroll into
    // view above it.
    Box(Modifier.fillMaxWidth().imePadding(), Alignment.TopCenter) {
        LazyColumn(
            contentPadding = padding,
            modifier = Modifier.widthIn(max = 720.dp).fillMaxWidth(),
        ) {
            item(key = "fields") {
                Column(
                    Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    ConflictBanner("title", viewModel.title) { viewModel.keepMine(viewModel.title) }
                    ConflictBanner("description", viewModel.description) {
                        viewModel.keepMine(viewModel.description)
                    }
                    OutlinedTextField(
                        value = viewModel.title.text(task.title),
                        onValueChange = {
                            viewModel.title.change(it, task.title)
                            // The title wraps, so the keyboard shows Enter: treat it as done.
                            if ('\n' in it) focus.clearFocus()
                        },
                        label = { Text("Title") },
                        enabled = enabled,
                        textStyle = MaterialTheme.typography.titleMedium,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
                        modifier =
                            Modifier.fillMaxWidth().commitOnBlur {
                                viewModel.commit(viewModel.title)
                            },
                    )
                    OutlinedTextField(
                        value = viewModel.description.text(task.description ?: ""),
                        onValueChange = {
                            viewModel.description.change(it, task.description ?: "")
                        },
                        label = { Text("Description") },
                        placeholder = { Text("Add a description") },
                        enabled = enabled,
                        minLines = 2,
                        maxLines = 12,
                        modifier =
                            Modifier.fillMaxWidth().commitOnBlur {
                                viewModel.commit(viewModel.description)
                            },
                    )
                    StatusPicker(
                        selected = task.status,
                        onSelect = { viewModel.moves.move(task, it) },
                        enabled = enabled,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    ProjectPicker(
                        selected = task.projectId,
                        projects = (projects as? Live.Loaded)?.value ?: emptyList(),
                        onSelect = {
                            if (it != task.projectId) {
                                viewModel.run(Calls.changeTaskProject(task.id, it))
                            }
                        },
                        enabled = enabled,
                    )
                    DueDateField(
                        date = DueDate.parse(task.dueDate),
                        onChange = { date ->
                            viewModel.run(
                                Calls.updateTask(
                                    task.id,
                                    dueDate = date?.let(DueDate::format) ?: "",
                                )
                            )
                        },
                        enabled = enabled,
                    )
                    AssigneePicker(
                        selected = task.assigneeSubject ?: "",
                        members = members.items,
                        currentUserId = Clerk.user?.id,
                        onSelect = {
                            if (it != (task.assigneeSubject ?: "")) {
                                viewModel.run(Calls.updateTask(task.id, assigneeSubject = it))
                            }
                        },
                        enabled = enabled,
                    )
                    Text(
                        "Created ${day(task.createdAt)} · Updated ${day(task.updatedAt)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            subtasksSection(task.id, subtasks, viewModel, enabled)
        }
    }
}

private val dayFormat = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)

private fun day(milliseconds: Double): String =
    convexInstant(milliseconds).atZone(ZoneId.systemDefault()).format(dayFormat)

/** Runs [commit] when the field loses focus after having it. */
@Composable
private fun Modifier.commitOnBlur(commit: () -> Unit): Modifier {
    var focused by remember { mutableStateOf(false) }
    return onFocusChanged {
        if (focused && !it.isFocused) commit()
        focused = it.isFocused
    }
}

@Composable
private fun ConflictBanner(
    name: String,
    field: EditableField,
    onKeepMine: () -> Unit,
) {
    if (field.conflict == null) return
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.WarningAmber, contentDescription = null)
                Text("The $name changed elsewhere.")
            }
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
            ) {
                TextButton(onClick = field::useLatest) { Text("Use Latest") }
                Button(onClick = onKeepMine) { Text("Keep Mine") }
            }
        }
    }
}
