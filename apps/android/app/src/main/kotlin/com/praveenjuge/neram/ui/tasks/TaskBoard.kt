package com.praveenjuge.neram.ui.tasks

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.praveenjuge.neram.data.TaskOrdering
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.model.TaskItem
import com.praveenjuge.neram.data.model.TaskStatus
import com.praveenjuge.neram.ui.common.LocalIsConnected

/** Where a dragged task would land relative to the row under it. */
private enum class Landing {
    Before,
    After,
}

/**
 * A task board. Narrow layouts show one status at a time; wider ones show kanban columns.
 * Long-press a task to drag it to another place, column, or status button; on phones, swipe right
 * to move it forward a status and left to move it back. Positions are per project, so boards that
 * mix projects (My Tasks, Focus) order each task among its own project's tasks, as on the web.
 */
@Composable
fun TaskBoard(
    tasks: List<TaskItem>,
    moves: TaskMoves,
    onOpenTask: (DocumentId) -> Unit,
    padding: PaddingValues,
    statuses: List<TaskStatus> = TaskStatus.entries,
    showsProject: Boolean = false,
    emptyText: String = "Nothing here yet.",
    header: @Composable () -> Unit = {},
) {
    LaunchedEffect(tasks) { moves.reconcile(tasks) }
    val board = BoardModel(moves.apply(tasks), moves, statuses, LocalIsConnected.current)
    BoxWithConstraints(Modifier.fillMaxSize()) {
        if (maxWidth < 600.dp) {
            CompactBoard(board, onOpenTask, padding, showsProject, emptyText, header)
        } else {
            KanbanBoard(board, onOpenTask, padding, showsProject, emptyText, header)
        }
    }
    TaskMoveDialogs(moves)
}

/** The board's tasks (with pending moves shown) and the moves it can make. */
private class BoardModel(
    val tasks: List<TaskItem>,
    val moves: TaskMoves,
    val statuses: List<TaskStatus>,
    val enabled: Boolean,
) {
    fun column(status: TaskStatus) = TaskOrdering.column(tasks, status)

    /** Moves the dragged task to [index] of [status]'s column. */
    fun drop(id: DocumentId, status: TaskStatus, index: Int) {
        // Moves need a connection; a drag can outlast one.
        if (!enabled) return
        val task = tasks.firstOrNull { it.id == id } ?: return
        val column = column(status)
        val from = column.indexOfFirst { it.id == id }
        // Dropping a task where it already is changes nothing.
        if (from >= 0 && (index == from || index == from + 1)) return
        moves.move(task, status, TaskOrdering.positionInMixed(column, index, task))
    }

    /** Dropped onto the row at [index]: lands after it when coming from above, else before it. */
    fun dropOnRow(id: DocumentId, status: TaskStatus, index: Int) =
        drop(id, status, if (landing(id, status, index) == Landing.After) index + 1 else index)

    fun landing(id: DocumentId?, status: TaskStatus, index: Int): Landing {
        val from = column(status).indexOfFirst { it.id == id }
        return if (from in 0 until index) Landing.After else Landing.Before
    }

    fun moveTo(task: TaskItem, status: TaskStatus) {
        if (enabled) moves.move(task, status)
    }

    /**
     * TalkBack actions: move to each other status, and up or down within the column. None while
     * offline, like the status button and dragging.
     */
    fun accessibilityActions(task: TaskItem, index: Int, count: Int) =
        if (!enabled) emptyList() else movesFor(task, index, count)

    private fun movesFor(task: TaskItem, index: Int, count: Int) = buildList {
        statuses
            .filter { it != task.status }
            .forEach {
                add(
                    CustomAccessibilityAction("Move to ${it.label}") {
                        moveTo(task, it)
                        true
                    }
                )
            }
        if (index > 0) {
            add(
                CustomAccessibilityAction("Move up") {
                    drop(task.id, task.status, index - 1)
                    true
                }
            )
        }
        if (index < count - 1) {
            add(
                CustomAccessibilityAction("Move down") {
                    drop(task.id, task.status, index + 2)
                    true
                }
            )
        }
    }
}

// Phone

@Composable
private fun CompactBoard(
    board: BoardModel,
    onOpenTask: (DocumentId) -> Unit,
    padding: PaddingValues,
    showsProject: Boolean,
    emptyText: String,
    header: @Composable () -> Unit,
) {
    var selected by rememberSaveable { mutableStateOf(board.statuses.first()) }
    val status = selected.takeIf { it in board.statuses } ?: board.statuses.first()
    val column = board.column(status)
    val list = rememberLazyListState()
    val scroller = rememberDragScroller(list)

    LazyColumn(
        state = list,
        contentPadding = padding,
        modifier =
            Modifier.fillMaxSize().then(scroller.bounds).taskDropTarget(scroller) {
                board.drop(it, status, column.size)
            },
    ) {
        item(key = "header") {
            Column(
                Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                header()
                StatusPicker(
                    selected = status,
                    onSelect = { selected = it },
                    modifier = Modifier.fillMaxWidth(),
                    statuses = board.statuses,
                    label = { "${it.label} ${board.tasks.count { task -> task.status == it }}" },
                    itemModifier = { target ->
                        Modifier.taskDropTarget(scroller) {
                            board.drop(it, target, board.column(target).size)
                        }
                    },
                )
            }
        }
        if (column.isEmpty()) {
            item(key = "empty") {
                Text(
                    emptyText,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 24.dp),
                )
            }
        }
        itemsIndexed(column, key = { _, task -> task.id }) { index, task ->
            DropRow(board, task, status, index, scroller) {
                TaskRow(
                    task,
                    showsProject = showsProject,
                    leading = { StatusMenu(board, task) },
                    modifier =
                        Modifier.semantics {
                                customActions = board.accessibilityActions(task, index, column.size)
                            }
                            .openAndDrag(task, board.enabled) { onOpenTask(task.id) },
                )
            }
        }
    }
}

/** The status icon as a button: tap for a menu that moves the task to another status. */
@Composable
private fun StatusMenu(board: BoardModel, task: TaskItem) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { open = true }, enabled = board.enabled) {
            StatusIcon(task.status, "${task.status.label}. Change status")
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            board.statuses
                .filter { it != task.status }
                .forEach { target ->
                    DropdownMenuItem(
                        text = { Text("Move to ${target.label}") },
                        leadingIcon = { Icon(target.icon, contentDescription = null) },
                        onClick = {
                            open = false
                            board.moveTo(task, target)
                        },
                    )
                }
        }
    }
}

/** A row that accepts dropped tasks and draws a line where they'll land. */
@Composable
private fun DropRow(
    board: BoardModel,
    task: TaskItem,
    status: TaskStatus,
    index: Int,
    scroller: DragScroller,
    content: @Composable () -> Unit,
) {
    var dragging by remember { mutableStateOf<DocumentId?>(null) }
    val line = MaterialTheme.colorScheme.primary
    Box(
        Modifier.taskDropTarget(
                scroller,
                onHover = { dragging = it.takeIf { id -> id != task.id } },
                onDrop = { board.dropOnRow(it, status, index) },
            )
            .drawWithContent {
                drawContent()
                val id = dragging ?: return@drawWithContent
                val y = if (board.landing(id, status, index) == Landing.After) size.height else 0f
                drawLine(line, Offset(0f, y), Offset(size.width, y), 3.dp.toPx())
            }
    ) {
        content()
    }
}

// Tablets, foldables, and wide windows

@Composable
private fun KanbanBoard(
    board: BoardModel,
    onOpenTask: (DocumentId) -> Unit,
    padding: PaddingValues,
    showsProject: Boolean,
    emptyText: String,
    header: @Composable () -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(padding)) {
        Box(Modifier.padding(horizontal = 16.dp)) { header() }
        Row(
            Modifier.fillMaxSize().horizontalScroll(rememberScrollState()).padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            board.statuses.forEach { status ->
                KanbanColumn(board, status, onOpenTask, showsProject, emptyText)
            }
        }
    }
}

@Composable
private fun KanbanColumn(
    board: BoardModel,
    status: TaskStatus,
    onOpenTask: (DocumentId) -> Unit,
    showsProject: Boolean,
    emptyText: String,
) {
    val column = board.column(status)
    val list = rememberLazyListState()
    val scroller = rememberDragScroller(list)
    var hovered by remember { mutableStateOf(false) }
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        shape = RoundedCornerShape(16.dp),
        border = if (hovered) BorderStroke(2.dp, MaterialTheme.colorScheme.primary) else null,
        modifier = Modifier.width(300.dp).fillMaxHeight(),
    ) {
        Column {
            Text(
                "${status.label} · ${column.size}",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(16.dp),
            )
            HorizontalDivider()
            LazyColumn(
                state = list,
                contentPadding = PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier =
                    Modifier.weight(1f).fillMaxWidth().then(scroller.bounds).taskDropTarget(
                        scroller,
                        onHover = { hovered = it != null },
                    ) {
                        board.drop(it, status, column.size)
                    },
            ) {
                if (column.isEmpty()) {
                    item(key = "empty") {
                        Text(
                            emptyText,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(vertical = 16.dp),
                        )
                    }
                }
                itemsIndexed(column, key = { _, task -> task.id }) { index, task ->
                    DropRow(board, task, status, index, scroller) {
                        Card(
                            colors =
                                CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.surface
                                ),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            TaskRow(
                                task,
                                showsProject = showsProject,
                                leading = { StatusMenu(board, task) },
                                modifier =
                                    Modifier.semantics {
                                            customActions =
                                                board.accessibilityActions(task, index, column.size)
                                        }
                                        .openAndDrag(task, board.enabled) { onOpenTask(task.id) },
                            )
                        }
                    }
                }
            }
        }
    }
}
