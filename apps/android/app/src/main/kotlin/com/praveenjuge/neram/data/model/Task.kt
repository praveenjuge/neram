package com.praveenjuge.neram.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * A task as returned by `tasks:list`, `tasks:get`, `tasks:listAll`, and the Sprint queries. The
 * cross-project queries also carry the parent project's display fields.
 */
@Serializable
data class TaskItem(
    @SerialName("_id") val id: DocumentId,
    val projectId: DocumentId,
    val title: String,
    val description: String? = null,
    /** Calendar date as `YYYY-MM-DD`. */
    val dueDate: String? = null,
    val status: TaskStatus,
    val assigneeSubject: String? = null,
    val assigneeName: String? = null,
    val currentSprintId: DocumentId? = null,
    val completedAt: Double? = null,
    val position: Double,
    val createdAt: Double,
    val updatedAt: Double,
    val totalSubtasks: Double,
    val completedSubtasks: Double,
    val activeCommentCount: Double,
    val projectName: String? = null,
    val projectIcon: String? = null,
    val projectColor: String? = null,
)

@Serializable
data class Subtask(
    @SerialName("_id") val id: DocumentId,
    val taskId: DocumentId,
    val title: String,
    val completed: Boolean,
    val position: Double,
)

/** `tasks:remove` result. */
@Serializable data class RemovedTask(val subtaskCount: Double, val commentCount: Double)
