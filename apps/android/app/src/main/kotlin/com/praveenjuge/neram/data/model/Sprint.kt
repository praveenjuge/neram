package com.praveenjuge.neram.data.model

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

private val shortDate = DateTimeFormatter.ofPattern("MMM d", Locale.US)
private val fullDate = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)

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

    /**
     * `MMM d – MMM d, yyyy`, or `Started MMM d, yyyy` with no fixed end. Mirrors `dateRange` in
     * apps/web/src/components/sprints/shared.tsx.
     */
    fun dateRange(zone: ZoneId = ZoneId.systemDefault()): String {
        val start = convexInstant(startsAt).atZone(zone)
        val end = endsAt?.let { convexInstant(it).atZone(zone) }
        return if (end == null) "Started ${start.format(fullDate)}"
        else "${start.format(shortDate)} – ${end.format(fullDate)}"
    }

    /** "N days remaining", "Ends today", or "No fixed end date". */
    fun remaining(now: Instant = Instant.now(), zone: ZoneId = ZoneId.systemDefault()): String {
        val end = endsAt ?: return "No fixed end date"
        val days =
            ChronoUnit.DAYS.between(
                    now.atZone(zone).toLocalDate(),
                    convexInstant(end).atZone(zone).toLocalDate(),
                )
                .coerceAtLeast(0)
        return when (days) {
            0L -> "Ends today"
            1L -> "1 day remaining"
            else -> "$days days remaining"
        }
    }
}

/** `sprints:current`: the open Sprint and its focused tasks. */
@Serializable data class CurrentSprint(val sprint: Sprint, val tasks: List<TaskItem>)
