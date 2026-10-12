package com.praveenjuge.neram.data

import com.praveenjuge.neram.data.model.Sprint
import com.praveenjuge.neram.data.model.TaskItem
import com.praveenjuge.neram.data.model.TaskStatus
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TaskOrderingTest {
    private fun task(
        id: String,
        position: Double = 0.0,
        project: String = "p",
        due: String? = null,
        status: TaskStatus = TaskStatus.Todo,
    ) =
        TaskItem(
            id = id,
            projectId = project,
            title = id,
            dueDate = due,
            status = status,
            position = position,
            createdAt = 0.0,
            updatedAt = 0.0,
            totalSubtasks = 0.0,
            completedSubtasks = 0.0,
            activeCommentCount = 0.0,
        )

    @Test
    fun positionsMatchTheWebHelper() {
        val column = listOf(task("a", 10.0), task("b", 20.0), task("c", 30.0))
        // Into the middle: midpoint of the neighbours.
        assertEquals(15.0, TaskOrdering.position(column, 1, "x"), 0.0)
        // To the top and the bottom.
        assertEquals(9.0, TaskOrdering.position(column, 0, "x"), 0.0)
        assertEquals(31.0, TaskOrdering.position(column, 3, "x"), 0.0)
        // Moving "a" below "b" skips "a" itself when counting neighbours.
        assertEquals(25.0, TaskOrdering.position(column, 2, "a"), 0.0)
        // An empty column uses the current time in milliseconds.
        assertEquals(5000.0, TaskOrdering.position(emptyList(), 0, "x", nowMillis = 5000.0), 0.0)
    }

    @Test
    fun mixedColumnsOrderWithinTheMovingTasksProject() {
        // Visual order: a1, b1, a2. Dropping a3 (project a) between b1 and a2 lands between a1
        // and a2 in project a's own ordering.
        val column = listOf(task("a1", 10.0, "a"), task("b1", 5.0, "b"), task("a2", 20.0, "a"))
        assertEquals(15.0, TaskOrdering.positionInMixed(column, 2, task("a3", 99.0, "a")), 0.0)
    }

    @Test
    fun dueDatesRoundTripAsCalendarDays() {
        val date = DueDate.parse("2026-01-20")
        assertEquals(LocalDate.of(2026, 1, 20), date)
        assertEquals("2026-01-20", DueDate.format(date!!))
        assertEquals("Jan 20, 2026", DueDate.display("2026-01-20"))
        assertNull(DueDate.parse("soon"))
        assertEquals("not-a-date", DueDate.display("not-a-date"))
    }

    @Test
    fun initialsMatchTheWeb() {
        assertEquals("AL", initials("Ada Lovelace"))
        assertEquals("AD", initials("ada"))
        assertEquals("MS", initials("Mary Ann Smith"))
        assertEquals("?", initials("  "))
    }

    @Test
    fun dueFiltersCombineWithOrAndSkipDoneWork() {
        val today = LocalDate.of(2026, 10, 12)
        val tasks =
            listOf(
                task("late", due = "2026-10-01"),
                task("lateDone", due = "2026-10-01", status = TaskStatus.Done),
                task("soon", due = "2026-10-19"),
                task("later", due = "2026-10-20"),
                task("none"),
            )
        fun ids(vararg filters: DueFilter) =
            DueFilter.apply(tasks, filters.toSet(), today).map { it.id }
        assertEquals(tasks.map { it.id }, ids())
        assertEquals(listOf("late"), ids(DueFilter.Overdue))
        assertEquals(listOf("soon"), ids(DueFilter.DueSoon))
        assertEquals(listOf("late", "none"), ids(DueFilter.Overdue, DueFilter.NoDueDate))
    }

    @Test
    fun sprintDatesMatchTheWeb() {
        val day = 86_400_000.0
        val utc = ZoneOffset.UTC
        fun sprint(endsAt: Double?) =
            Sprint("s", 1.0, state = Sprint.State.Current, startsAt = 0.0, endsAt = endsAt)
        val now = Instant.EPOCH
        assertEquals("3 days remaining", sprint(3 * day).remaining(now, utc))
        assertEquals("1 day remaining", sprint(day).remaining(now, utc))
        assertEquals("Ends today", sprint(day / 2).remaining(now, utc))
        assertEquals("No fixed end date", sprint(null).remaining(now, utc))
        assertEquals("Jan 1 – Jan 15, 1970", sprint(14 * day).dateRange(utc))
        assertEquals("Started Jan 1, 1970", sprint(null).dateRange(utc))
    }
}
