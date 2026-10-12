package com.praveenjuge.neram.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Sprint(
    @SerialName("_id") val id: DocumentId,
    val number: Double,
    val goal: String? = null,
    val state: State,
    val startsAt: Double,
    val endsAt: Double? = null,
    val closedAt: Double? = null,
    val baselineCount: Double? = null,
    val completedCount: Double? = null,
) {
    @Serializable
    enum class State {
        @SerialName("current") Current,
        @SerialName("closed") Closed,
    }
}

/** `sprints:current`: the open Sprint and its focused tasks. */
@Serializable data class CurrentSprint(val sprint: Sprint, val tasks: List<TaskItem>)
