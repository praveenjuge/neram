package com.praveenjuge.neram.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `projects:list`, `projects:get`, and `projects:listArchived` rows. */
@Serializable
data class ProjectSummary(
    @SerialName("_id") val id: DocumentId,
    val name: String,
    val icon: String? = null,
    val color: String? = null,
    val createdAt: Double,
    val updatedAt: Double,
    val taskCount: Double,
    val todoCount: Double,
    val inProgressCount: Double,
    val doneCount: Double,
    val role: OrganizationRole,
)

/** `projects:names`: the lightweight list used by pickers. */
@Serializable
data class ProjectName(
    @SerialName("_id") val id: DocumentId,
    val name: String,
    val icon: String? = null,
    val color: String? = null,
    val role: OrganizationRole,
    val openCount: Double,
)
