package com.praveenjuge.neram.data

import dev.convex.android.ConvexError
import kotlinx.serialization.Serializable

/**
 * The `ConvexError` payload every Neram function throws: `{ code, message }` plus extra fields for
 * the errors clients resolve with a confirm-and-retry. Shapes are pinned by
 * `packages/convex/fixtures/errors.*.json`.
 */
@Serializable
data class ServerError(
    val code: String,
    val message: String,
    /** `EDIT_CONFLICT`: the field that changed and its newest value. */
    val field: String? = null,
    val latestValue: String? = null,
    /** `INCOMPLETE_SUBTASKS` */
    val unfinishedCount: Double? = null,
    val totalSubtasks: Double? = null,
    val completedSubtasks: Double? = null,
    /** `CASCADE_CONFIRMATION_REQUIRED` */
    val subtaskCount: Double? = null,
    val commentCount: Double? = null,
)

sealed class NeramError(message: String) : Exception(message) {
    /** A deliberate error from a Neram function, such as validation or permissions. */
    data class Server(val payload: ServerError) : NeramError(payload.message)

    /** There is no active Clerk session to authenticate with. */
    data object SignedOut : NeramError("Sign in to continue.")

    /** Anything else: transport failures, unexpected server errors, bad payloads. */
    data class Unexpected(val detail: String) : NeramError("Something went wrong. Try again.")

    val code: String?
        get() = (this as? Server)?.payload?.code

    companion object {
        fun from(error: Throwable): NeramError =
            when (error) {
                is NeramError -> error
                is ConvexError ->
                    runCatching { NeramJson.decodeFromString(ServerError.serializer(), error.data) }
                        .map { Server(it) }
                        .getOrElse { Unexpected(error.data) }
                else -> Unexpected(error.toString())
            }
    }
}
