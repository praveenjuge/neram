package com.praveenjuge.neram.data

import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.model.TaskItem
import com.praveenjuge.neram.data.model.TaskStatus
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale

/**
 * Board ordering helpers shared by every task list. Each mirrors a web helper so both clients order
 * tasks identically.
 */
object TaskOrdering {
    /**
     * The `position` for `tasks:move` when dropping [movingId] at [insertIndex] of [destination]
     * (already sorted by position). Mirrors `positionFor` in
     * apps/web/src/components/project-board/board-shared.tsx.
     */
    fun position(
        destination: List<TaskItem>,
        insertIndex: Int,
        movingId: DocumentId,
        nowMillis: Double = System.currentTimeMillis().toDouble(),
    ): Double {
        val list = destination.filter { it.id != movingId }
        val adjusted = destination.take(insertIndex.coerceAtLeast(0)).count { it.id != movingId }
        val before = list.getOrNull(adjusted - 1)
        val after = list.getOrNull(adjusted)
        return when {
            before == null && after == null -> nowMillis
            before == null -> after!!.position - 1
            after == null -> before.position + 1
            else -> (before.position + after.position) / 2
        }
    }

    /**
     * Like [position] for a column that mixes projects, as on My Tasks. Positions are per project,
     * so the visual index maps onto the moving task's project only, as on the web.
     */
    fun positionInMixed(
        column: List<TaskItem>,
        insertIndex: Int,
        moving: TaskItem,
        nowMillis: Double = System.currentTimeMillis().toDouble(),
    ): Double {
        val sameProject = column.filter { it.projectId == moving.projectId }
        val index =
            column.take(insertIndex.coerceAtLeast(0)).count { it.projectId == moving.projectId }
        return position(sameProject, index, moving.id, nowMillis)
    }

    /** Tasks of one status, in board order. */
    fun column(tasks: List<TaskItem>, status: TaskStatus): List<TaskItem> =
        tasks.filter { it.status == status }.sortedBy { it.position }
}

/** Due dates are stored as plain `yyyy-MM-dd` calendar dates. */
object DueDate {
    private val display = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)

    fun parse(value: String?): LocalDate? = value?.let {
        try {
            LocalDate.parse(it)
        } catch (_: DateTimeParseException) {
            null
        }
    }

    fun format(date: LocalDate): String = date.toString()

    /** `MMM d, yyyy`, like the web; unparseable values show as stored. */
    fun display(value: String?): String {
        if (value == null) return ""
        return parse(value)?.format(display) ?: value
    }
}

/** Avatar initials, matching apps/web/src/components/user-avatar.tsx. */
fun initials(name: String): String {
    val parts = name.split(Regex("\\s+")).filter { it.isNotEmpty() }
    val first = parts.firstOrNull() ?: return "?"
    if (parts.size == 1) return first.take(2).uppercase()
    return (first.take(1) + parts.last().take(1)).uppercase()
}
