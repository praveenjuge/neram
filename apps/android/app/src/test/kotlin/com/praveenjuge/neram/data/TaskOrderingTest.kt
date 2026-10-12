package com.praveenjuge.neram.data

import com.praveenjuge.neram.data.model.TaskItem
import com.praveenjuge.neram.data.model.TaskStatus
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TaskOrderingTest {
    private fun task(id: String, position: Double, project: String = "p") =
        TaskItem(
            id = id,
            projectId = project,
            title = id,
            status = TaskStatus.Todo,
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
}
