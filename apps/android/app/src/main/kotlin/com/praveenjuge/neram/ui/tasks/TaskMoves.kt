package com.praveenjuge.neram.ui.tasks

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.praveenjuge.neram.data.Calls
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.NeramError
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.model.TaskItem
import com.praveenjuge.neram.data.model.TaskStatus
import com.praveenjuge.neram.ui.common.ActionErrorDialog
import com.praveenjuge.neram.ui.common.ActionState
import com.praveenjuge.neram.ui.common.ConfirmDialog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Moves tasks between statuses and positions. Keeps each move visible until the live query confirms
 * it (the native SDK has no optimistic updates) and asks before marking a task Done while it has
 * open subtasks. Owned by a view model; call from the main thread.
 */
class TaskMoves(private val client: NeramClient, private val scope: CoroutineScope) {
    /** Compared by identity, so a newer move of the same task is never cleared by an older one. */
    private class Pending(val status: TaskStatus, val position: Double?) {
        /**
         * Where to show the task meanwhile. Without a position the server appends at the current
         * time in milliseconds (`tasks:move`), so show it there too.
         */
        val shownPosition = position ?: System.currentTimeMillis().toDouble()
    }

    /** A Done move the server refused because subtasks are still open. */
    data class IncompleteMove(val task: TaskItem, val position: Double?, val unfinished: Int)

    private val pending = mutableStateMapOf<DocumentId, Pending>()
    var incomplete by mutableStateOf<IncompleteMove?>(null)
    val action = ActionState()

    /** [tasks] with in-flight moves applied. */
    fun apply(tasks: List<TaskItem>): List<TaskItem> = tasks.map { task ->
        val move = pending[task.id] ?: return@map task
        task.copy(status = move.status, position = move.shownPosition)
    }

    /** Drops moves the live query now reflects. Call when the tasks change. */
    fun reconcile(tasks: List<TaskItem>) {
        for (task in tasks) {
            val move = pending[task.id] ?: continue
            if (
                task.status == move.status &&
                    (move.position == null || task.position == move.position)
            ) {
                pending.remove(task.id)
            }
        }
    }

    fun move(
        task: TaskItem,
        status: TaskStatus,
        position: Double? = null,
        confirmed: Boolean = false,
    ) {
        val move = Pending(status, position)
        pending[task.id] = move
        scope.launch {
            try {
                client.run(Calls.moveTask(task.id, status, position, confirmed))
            } catch (error: NeramError) {
                if (pending[task.id] === move) pending.remove(task.id)
                val payload = (error as? NeramError.Server)?.payload
                if (payload?.code == "INCOMPLETE_SUBTASKS") {
                    incomplete =
                        IncompleteMove(task, position, payload.unfinishedCount?.toInt() ?: 0)
                } else {
                    action.error = error
                }
                return@launch
            }
            // reconcile() normally clears this as soon as the subscription catches up; stop
            // overriding regardless if someone else moved the task again.
            delay(5_000)
            if (pending[task.id] === move) pending.remove(task.id)
        }
    }
}

/** The confirmation the web shows as "N subtasks still open", plus move failures. */
@Composable
fun TaskMoveDialogs(moves: TaskMoves) {
    moves.incomplete?.let { move ->
        ConfirmDialog(
            title = "${move.unfinished} subtask${if (move.unfinished == 1) "" else "s"} still open",
            message = "Marking a task Done normally requires all of its subtasks to be finished.",
            confirmLabel = "Move Anyway",
            onConfirm = { moves.move(move.task, TaskStatus.Done, move.position, confirmed = true) },
            onDismiss = { moves.incomplete = null },
        )
    }
    ActionErrorDialog(moves.action, "Couldn't move that task")
}
