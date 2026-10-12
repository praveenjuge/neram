package com.praveenjuge.neram.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * One row of `activity:list`. `type` stays a string so new server event types still decode;
 * [action] falls back to a generic phrase for unknown ones.
 */
@Serializable
data class ActivityItem(
    @SerialName("_id") val id: DocumentId,
    val type: String,
    val actorUserId: String,
    val actorName: String,
    val recipientUserId: String? = null,
    val projectId: DocumentId? = null,
    val projectName: String? = null,
    val sprintId: DocumentId? = null,
    val sprintNumber: Double? = null,
    val taskId: DocumentId? = null,
    val taskTitle: String? = null,
    val commentId: DocumentId? = null,
    val commentExcerpt: String? = null,
    val toStatus: TaskStatus? = null,
    val assigneeName: String? = null,
    val createdAt: Double,
) {
    /**
     * A short past-tense phrase for what the actor did. Mirrors `describe` in
     * apps/web/src/app/w/[organizationSlug]/(app)/activity/activity-client.tsx.
     */
    val action: String
        get() {
            val task = taskTitle ?: "a task"
            val sprint = sprintNumber?.let { " ${it.toInt()}" } ?: ""
            return when (type) {
                "task.created" -> "added $task"
                "task.moved" -> "moved $task to ${toStatus?.label ?: "another column"}"
                "task.assigned" -> "assigned $task to ${assigneeName ?: "someone"}"
                "task.deleted" -> "deleted $task"
                "project.updated" -> "updated the project"
                "member.joined" -> "joined"
                "member.left" -> "left"
                "member.removed" -> "was removed"
                "comment.mentioned" -> "mentioned you on $task"
                "comment.replied" -> "replied to you on $task"
                "sprint.started" -> "started Sprint$sprint"
                "sprint.ended" -> "ended Sprint$sprint"
                "sprint.duration_changed" -> "updated the default Sprint duration"
                "sprint.rolled_over" -> "rolled over Sprint$sprint"
                "sprint.early_closed" -> "closed Sprint$sprint early"
                "sprint.cadence_changed" -> "updated the Sprint cadence"
                else -> "made a change"
            }
        }
}
