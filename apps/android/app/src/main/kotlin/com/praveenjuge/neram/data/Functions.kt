package com.praveenjuge.neram.data

import com.praveenjuge.neram.data.model.ActivityItem
import com.praveenjuge.neram.data.model.CommentAncestry
import com.praveenjuge.neram.data.model.CurrentOrganization
import com.praveenjuge.neram.data.model.CurrentSprint
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.model.Invitation
import com.praveenjuge.neram.data.model.Member
import com.praveenjuge.neram.data.model.Mention
import com.praveenjuge.neram.data.model.OrganizationRole
import com.praveenjuge.neram.data.model.Page
import com.praveenjuge.neram.data.model.ProjectName
import com.praveenjuge.neram.data.model.ProjectSummary
import com.praveenjuge.neram.data.model.RemovedTask
import com.praveenjuge.neram.data.model.Sprint
import com.praveenjuge.neram.data.model.SprintDuration
import com.praveenjuge.neram.data.model.Subtask
import com.praveenjuge.neram.data.model.TaskComment
import com.praveenjuge.neram.data.model.TaskItem
import com.praveenjuge.neram.data.model.TaskStatus
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.nullable
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Convex function arguments. Numbers must be [Double]: the Convex client sends Kotlin `Int` and
 * `Long` as int64, which `v.number()` validators reject. A key mapped to `null` sends an explicit
 * null; leave a key out to omit the argument.
 */
typealias Args = Map<String, Any?>

/** A typed reference to a Convex query and its arguments. */
class Query<T>(val name: String, val args: Args, val serializer: KSerializer<T>) {
    /** Identifies this exact query and arguments, e.g. for the offline cache. */
    val key: String = name + canonical(args)
}

/** A typed reference to a Convex mutation or action and its arguments. */
class Call<T>(val name: String, val kind: Kind, val args: Args, val serializer: KSerializer<T>) {
    enum class Kind {
        Mutation,
        Action,
    }
}

/** `paginationOpts` for Convex paginated queries. */
data class PageRequest(
    val numItems: Int,
    val cursor: String? = null,
    val endCursor: String? = null,
) {
    val arg: Args
        get() = buildMap {
            put("numItems", numItems.toDouble())
            put("cursor", cursor)
            if (endCursor != null) put("endCursor", endCursor)
        }
}

/** Decodes a Convex `null` result, for functions that return nothing. */
object NoResult : KSerializer<Unit> {
    override val descriptor: SerialDescriptor = JsonElement.serializer().descriptor

    override fun deserialize(decoder: Decoder) {
        (decoder as JsonDecoder).decodeJsonElement()
    }

    override fun serialize(encoder: Encoder, value: Unit) {
        encoder.encodeSerializableValue(JsonElement.serializer(), JsonNull)
    }
}

/**
 * Every Convex query the app reads. Names and arguments mirror packages/convex/convex; result
 * shapes are pinned by packages/convex/fixtures.
 */
object Queries {
    val currentOrganization =
        Query("organizations:current", emptyMap(), CurrentOrganization.serializer())

    fun members(page: PageRequest) =
        Query(
            "organizations:members",
            mapOf("paginationOpts" to page.arg),
            Page.serializer(Member.serializer()),
        )

    val projects = Query("projects:list", emptyMap(), ListSerializer(ProjectSummary.serializer()))
    val projectNames = Query("projects:names", emptyMap(), ListSerializer(ProjectName.serializer()))

    fun project(projectId: DocumentId) =
        Query("projects:get", mapOf("projectId" to projectId), ProjectSummary.serializer().nullable)

    fun archivedProjects(page: PageRequest) =
        Query(
            "projects:listArchived",
            mapOf("paginationOpts" to page.arg),
            Page.serializer(ProjectSummary.serializer()),
        )

    fun tasks(projectId: DocumentId) =
        Query("tasks:list", mapOf("projectId" to projectId), ListSerializer(TaskItem.serializer()))

    fun allTasks(assignedToMe: Boolean) =
        Query(
            "tasks:listAll",
            mapOf("assignedToMe" to assignedToMe),
            ListSerializer(TaskItem.serializer()),
        )

    fun task(taskId: DocumentId) =
        Query("tasks:get", mapOf("taskId" to taskId), TaskItem.serializer().nullable)

    fun subtasks(taskId: DocumentId, hideCompleted: Boolean = false) =
        Query(
            "subtasks:list",
            mapOf("taskId" to taskId, "hideCompleted" to hideCompleted),
            ListSerializer(Subtask.serializer()),
        )

    fun comments(taskId: DocumentId, page: PageRequest, parentCommentId: DocumentId? = null) =
        Query(
            "taskComments:list",
            buildMap {
                put("taskId", taskId)
                put("paginationOpts", page.arg)
                if (parentCommentId != null) put("parentCommentId", parentCommentId)
            },
            Page.serializer(TaskComment.serializer()),
        )

    fun commentAncestry(
        commentId: DocumentId,
        startCommentId: DocumentId? = null,
        limit: Int? = null,
    ) =
        Query(
            "taskComments:getAncestry",
            buildMap {
                put("commentId", commentId)
                if (startCommentId != null) put("startCommentId", startCommentId)
                if (limit != null) put("limit", limit.toDouble())
            },
            CommentAncestry.serializer(),
        )

    val currentSprint = Query("sprints:current", emptyMap(), CurrentSprint.serializer().nullable)
    val backlog = Query("sprints:backlog", emptyMap(), ListSerializer(TaskItem.serializer()))

    fun sprintHistory(page: PageRequest) =
        Query(
            "sprints:history",
            mapOf("paginationOpts" to page.arg),
            Page.serializer(Sprint.serializer()),
        )

    fun activity(page: PageRequest) =
        Query(
            "activity:list",
            mapOf("paginationOpts" to page.arg),
            Page.serializer(ActivityItem.serializer()),
        )
}

/** Every Convex mutation and action the app calls. */
object Calls {
    private fun mutation(name: String, args: Args = emptyMap()) =
        Call(name, Call.Kind.Mutation, args, NoResult)

    private fun <T> mutation(name: String, args: Args, serializer: KSerializer<T>) =
        Call(name, Call.Kind.Mutation, args, serializer)

    // Workspace

    /**
     * Projects the active Clerk organization into Convex. Run after sign-in and after every
     * organization switch, before any query.
     */
    val syncCurrentOrganization =
        Call("organizationActions:syncCurrent", Call.Kind.Action, emptyMap(), NoResult)

    fun invite(email: String, role: OrganizationRole = OrganizationRole.Member) =
        Call(
            "organizationActions:invite",
            Call.Kind.Action,
            mapOf("email" to email, "role" to role.wire),
            Invitation.serializer(),
        )

    // Projects

    fun createProject(name: String, icon: String?, color: String?) =
        mutation(
            "projects:create",
            buildMap {
                put("name", name)
                if (icon != null) put("icon", icon)
                if (color != null) put("color", color)
            },
            String.serializer(),
        )

    fun updateProject(
        projectId: DocumentId,
        name: String? = null,
        icon: String? = null,
        color: String? = null,
    ) =
        mutation(
            "projects:update",
            buildMap {
                put("projectId", projectId)
                if (name != null) put("name", name)
                if (icon != null) put("icon", icon)
                if (color != null) put("color", color)
            },
        )

    fun archiveProject(projectId: DocumentId) =
        mutation("projects:archive", mapOf("projectId" to projectId))

    fun unarchiveProject(projectId: DocumentId) =
        mutation("projects:unarchive", mapOf("projectId" to projectId))

    fun removeProject(projectId: DocumentId) =
        mutation("projects:remove", mapOf("projectId" to projectId))

    // Tasks

    fun createTask(
        projectId: DocumentId,
        title: String,
        description: String? = null,
        dueDate: String? = null,
        assigneeSubject: String? = null,
    ) =
        mutation(
            "tasks:create",
            buildMap {
                put("projectId", projectId)
                put("title", title)
                if (description != null) put("description", description)
                if (dueDate != null) put("dueDate", dueDate)
                if (assigneeSubject != null) put("assigneeSubject", assigneeSubject)
            },
            String.serializer(),
        )

    /**
     * Fields left out are untouched. Pass the value the user started editing from as `expected…` so
     * a newer edit by someone else returns `EDIT_CONFLICT` instead of being overwritten. For the
     * description, [ExpectedDescription.Empty] means it was empty.
     */
    fun updateTask(
        taskId: DocumentId,
        title: String? = null,
        expectedTitle: String? = null,
        description: String? = null,
        expectedDescription: ExpectedDescription? = null,
        dueDate: String? = null,
        assigneeSubject: String? = null,
    ) =
        mutation(
            "tasks:update",
            buildMap {
                put("taskId", taskId)
                if (title != null) put("title", title)
                if (expectedTitle != null) put("expectedTitle", expectedTitle)
                if (description != null) put("description", description)
                when (expectedDescription) {
                    null -> {}
                    ExpectedDescription.Empty -> put("expectedDescription", null)
                    is ExpectedDescription.Text ->
                        put("expectedDescription", expectedDescription.value)
                }
                if (dueDate != null) put("dueDate", dueDate)
                if (assigneeSubject != null) put("assigneeSubject", assigneeSubject)
            },
        )

    sealed interface ExpectedDescription {
        data object Empty : ExpectedDescription

        data class Text(val value: String) : ExpectedDescription
    }

    fun moveTask(
        taskId: DocumentId,
        status: TaskStatus,
        position: Double? = null,
        confirmIncompleteSubtasks: Boolean = false,
    ) =
        mutation(
            "tasks:move",
            buildMap {
                put("taskId", taskId)
                put("status", status.wire)
                if (position != null) put("position", position)
                if (confirmIncompleteSubtasks) put("confirmIncompleteSubtasks", true)
            },
        )

    fun changeTaskProject(taskId: DocumentId, projectId: DocumentId) =
        mutation("tasks:changeProject", mapOf("taskId" to taskId, "projectId" to projectId))

    fun removeTask(taskId: DocumentId, confirmCascade: Boolean = false) =
        mutation(
            "tasks:remove",
            buildMap {
                put("taskId", taskId)
                if (confirmCascade) put("confirmCascade", true)
            },
            RemovedTask.serializer(),
        )

    // Subtasks

    fun createSubtask(taskId: DocumentId, title: String) =
        mutation(
            "subtasks:create",
            mapOf("taskId" to taskId, "title" to title),
            String.serializer(),
        )

    fun renameSubtask(subtaskId: DocumentId, title: String) =
        mutation("subtasks:rename", mapOf("subtaskId" to subtaskId, "title" to title))

    fun setSubtaskCompleted(subtaskId: DocumentId, completed: Boolean) =
        mutation("subtasks:setCompleted", mapOf("subtaskId" to subtaskId, "completed" to completed))

    fun removeSubtask(subtaskId: DocumentId) =
        mutation("subtasks:remove", mapOf("subtaskId" to subtaskId))

    // Comments

    fun createComment(taskId: DocumentId, body: String, mentions: List<Mention>) =
        mutation(
            "taskComments:create",
            mapOf("taskId" to taskId, "body" to body, "mentions" to mentions.arg),
            String.serializer(),
        )

    fun replyToComment(commentId: DocumentId, body: String, mentions: List<Mention>) =
        mutation(
            "taskComments:reply",
            mapOf("commentId" to commentId, "body" to body, "mentions" to mentions.arg),
            String.serializer(),
        )

    fun editComment(commentId: DocumentId, body: String, mentions: List<Mention>) =
        mutation(
            "taskComments:edit",
            mapOf("commentId" to commentId, "body" to body, "mentions" to mentions.arg),
        )

    fun removeComment(commentId: DocumentId) =
        mutation("taskComments:remove", mapOf("commentId" to commentId))

    // Sprints

    fun startSprint(goal: String? = null, duration: SprintDuration? = null) =
        mutation(
            "sprints:start",
            buildMap {
                if (goal != null) put("goal", goal)
                if (duration != null) put("duration", duration.arg)
            },
            String.serializer(),
        )

    fun planSprint(taskIds: List<DocumentId>) =
        mutation("sprints:plan", mapOf("taskIds" to taskIds))

    fun returnToBacklog(taskIds: List<DocumentId>) =
        mutation("sprints:remove", mapOf("taskIds" to taskIds))

    /** `null` clears the goal. */
    fun updateSprintGoal(goal: String?) =
        mutation("sprints:updateGoal", buildMap { if (goal != null) put("goal", goal) })

    fun updateSprintDuration(duration: SprintDuration) =
        mutation("sprints:updateDuration", mapOf("duration" to duration.arg))

    val endSprint = mutation("sprints:end", mapOf("confirm" to true), String.serializer())
}

private val OrganizationRole.wire: String
    get() =
        when (this) {
            OrganizationRole.Admin -> "org:admin"
            OrganizationRole.Member -> "org:member"
        }

private val TaskStatus.wire: String
    get() =
        when (this) {
            TaskStatus.Todo -> "todo"
            TaskStatus.InProgress -> "inProgress"
            TaskStatus.Done -> "done"
        }

private val SprintDuration.arg: Any
    get() = if (this == SprintDuration.Open) "open" else wire.content.toDouble()

private val List<Mention>.arg: List<Args>
    get() = map {
        mapOf(
            "start" to it.start,
            "length" to it.length,
            "subject" to it.subject,
            "label" to it.label,
        )
    }

/** Stable JSON for [args], with sorted keys, used as a cache key. */
internal fun canonical(args: Args): String = toJson(args).toString()

private fun toJson(value: Any?): JsonElement =
    when (value) {
        null -> JsonNull
        is String -> JsonPrimitive(value)
        is Boolean -> JsonPrimitive(value)
        is Double -> JsonPrimitive(value)
        is List<*> -> JsonArray(value.map(::toJson))
        is Map<*, *> ->
            JsonObject(
                value.entries
                    .sortedBy { it.key as String }
                    .associate { (k, v) -> k as String to toJson(v) }
            )
        else -> error("Unsupported Convex argument: ${value::class.simpleName}")
    }
