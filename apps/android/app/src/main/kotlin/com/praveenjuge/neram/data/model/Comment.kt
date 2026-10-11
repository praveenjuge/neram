package com.praveenjuge.neram.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * An @mention inside a comment body. `start` and `length` count UTF-16 code units, the same units
 * as Kotlin strings and JavaScript.
 */
@Serializable
data class Mention(val start: Double, val length: Double, val subject: String, val label: String)

@Serializable
data class TaskComment(
    @SerialName("_id") val id: DocumentId,
    val taskId: DocumentId,
    val parentCommentId: DocumentId? = null,
    val rootCommentId: DocumentId? = null,
    val authorSubject: String,
    val authorName: String,
    val body: String,
    val mentions: List<Mention>,
    val createdAt: Double,
    val updatedAt: Double,
    /** Set when the comment was removed but kept as a tombstone for its replies. */
    val deletedAt: Double? = null,
) {
    val isDeleted: Boolean
        get() = deletedAt != null

    val isEdited: Boolean
        get() = updatedAt > createdAt
}

/** `taskComments:getAncestry`: the chain from a root comment down to a target. */
@Serializable
data class CommentAncestry(
    val taskId: DocumentId,
    val comments: List<TaskComment>,
    val nextCommentId: DocumentId? = null,
)
