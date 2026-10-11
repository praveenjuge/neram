package com.praveenjuge.neram.data.model

import java.time.Instant
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** A Convex document ID. IDs are opaque strings on the wire. */
typealias DocumentId = String

@Serializable
enum class OrganizationRole {
    @SerialName("org:admin") Admin,
    @SerialName("org:member") Member,
}

@Serializable
enum class TaskStatus(val label: String) {
    @SerialName("todo") Todo("Todo"),
    @SerialName("inProgress") InProgress("In Progress"),
    @SerialName("done") Done("Done"),
}

/** One page of a Convex paginated query. */
@Serializable
data class Page<T>(
    val page: List<T>,
    val isDone: Boolean,
    val continueCursor: String,
    /** Set when the server recommends or requires splitting this page in two. */
    val splitCursor: String? = null,
    /** `"SplitRecommended"` or `"SplitRequired"` when present. */
    val pageStatus: String? = null,
)

/** Convex timestamps are milliseconds since the Unix epoch, sent as float64. */
fun convexInstant(milliseconds: Double): Instant = Instant.ofEpochMilli(milliseconds.toLong())
