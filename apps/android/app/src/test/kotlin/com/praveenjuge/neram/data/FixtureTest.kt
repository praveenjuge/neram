package com.praveenjuge.neram.data

import com.praveenjuge.neram.data.model.ActivityItem
import com.praveenjuge.neram.data.model.CommentAncestry
import com.praveenjuge.neram.data.model.CurrentOrganization
import com.praveenjuge.neram.data.model.CurrentSprint
import com.praveenjuge.neram.data.model.Member
import com.praveenjuge.neram.data.model.Page
import com.praveenjuge.neram.data.model.ProjectName
import com.praveenjuge.neram.data.model.ProjectSummary
import com.praveenjuge.neram.data.model.Sprint
import com.praveenjuge.neram.data.model.SprintDuration
import com.praveenjuge.neram.data.model.Subtask
import com.praveenjuge.neram.data.model.TaskComment
import com.praveenjuge.neram.data.model.TaskItem
import com.praveenjuge.neram.data.model.TaskStatus
import java.io.File
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.nullable
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Decodes the backend's contract fixtures (packages/convex/fixtures, written by
 * packages/convex/convex/contract.test.ts) into the app's models. A failure here means a backend
 * shape changed and the Kotlin model must follow.
 */
class FixtureTest {
    private val fixtures = File("../../../packages/convex/fixtures")

    private fun <T> decode(serializer: KSerializer<T>, name: String): T {
        val value = NeramJson.decodeFromString(serializer, File(fixtures, "$name.json").readText())
        // Every model is also written to the offline cache, so it must round-trip.
        assertEquals(
            value,
            NeramJson.decodeFromString(serializer, NeramJson.encodeToString(serializer, value)),
        )
        return value
    }

    @Test
    fun organization() {
        val current = decode(CurrentOrganization.serializer(), "organizations.current")
        assertEquals("acme", current.organization.slug)
        assertTrue(current.isAdmin)
        assertEquals(SprintDuration.OneWeek, current.settings?.sprintDuration)
        val members = decode(Page.serializer(Member.serializer()), "organizations.members")
        assertEquals(listOf("Alice", "Bob"), members.page.map { it.displayName })
        assertTrue(members.isDone)
    }

    @Test
    fun projects() {
        val list = decode(ListSerializer(ProjectSummary.serializer()), "projects.list")
        assertEquals("folder-kanban", list.first().icon)
        assertEquals(3.0, list.first().taskCount, 0.0)
        assertEquals("Roadmap", decode(ProjectSummary.serializer().nullable, "projects.get")?.name)
        assertEquals(
            2.0,
            decode(ListSerializer(ProjectName.serializer()), "projects.names").first().openCount,
            0.0,
        )
        val archived = decode(Page.serializer(ProjectSummary.serializer()), "projects.listArchived")
        assertNull(archived.page.first().icon)
    }

    @Test
    fun tasks() {
        val task = assertNotNullValue(decode(TaskItem.serializer().nullable, "tasks.get"))
        assertEquals(TaskStatus.Todo, task.status)
        assertEquals("2026-01-20", task.dueDate)
        assertEquals("Bob", task.assigneeName)
        assertEquals(1.0, task.completedSubtasks, 0.0)
        assertEquals(3, decode(ListSerializer(TaskItem.serializer()), "tasks.list").size)
        val all = decode(ListSerializer(TaskItem.serializer()), "tasks.listAll")
        assertTrue(all.all { it.projectName == "Roadmap" })
        val subtasks = decode(ListSerializer(Subtask.serializer()), "subtasks.list")
        assertEquals(listOf(true, false), subtasks.map { it.completed })
    }

    @Test
    fun sprints() {
        val current =
            assertNotNullValue(decode(CurrentSprint.serializer().nullable, "sprints.current"))
        assertEquals(Sprint.State.Current, current.sprint.state)
        assertTrue(current.tasks.isNotEmpty())
        decode(ListSerializer(TaskItem.serializer()), "sprints.backlog")
        val history = decode(Page.serializer(Sprint.serializer()), "sprints.history")
        assertTrue(history.page.all { it.state == Sprint.State.Closed })
    }

    @Test
    fun commentsAndActivity() {
        val comments = decode(Page.serializer(TaskComment.serializer()), "taskComments.list")
        val mention = comments.page.flatMap { it.mentions }.first()
        // Mention offsets are UTF-16 code units, the same as Kotlin string indices.
        val body = comments.page.first { it.mentions.isNotEmpty() }.body
        val start = mention.start.toInt()
        assertEquals("@${mention.label}", body.substring(start, start + mention.length.toInt()))
        val ancestry = decode(CommentAncestry.serializer(), "taskComments.getAncestry")
        assertTrue(ancestry.comments.isNotEmpty())
        val activity = decode(Page.serializer(ActivityItem.serializer()), "activity.list")
        assertTrue(activity.page.all { it.action.isNotBlank() })
    }

    @Test
    fun errors() {
        val conflict = decode(ServerError.serializer(), "errors.EDIT_CONFLICT")
        assertEquals("EDIT_CONFLICT", conflict.code)
        assertEquals("title", conflict.field)
        assertNotNull(
            decode(ServerError.serializer(), "errors.INCOMPLETE_SUBTASKS").unfinishedCount
        )
        assertNotNull(
            decode(ServerError.serializer(), "errors.CASCADE_CONFIRMATION_REQUIRED").subtaskCount
        )
    }

    private fun <T : Any> assertNotNullValue(value: T?): T {
        assertNotNull(value)
        return value!!
    }
}
