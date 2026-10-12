package com.praveenjuge.neram.data

import com.praveenjuge.neram.data.model.DocumentId
import java.net.URI
import java.net.URISyntaxException
import java.net.URLDecoder

/**
 * An App Link into the app. These are the web's own workspace URLs, so one link works in the
 * browser and in the app. Mirrors NeramKit's `DeepLink`:
 * - `/w`: the workspace picker
 * - `/w/{slug}/dashboard`
 * - `/w/{slug}/projects/{id}?task={taskId}&comment={commentId}`
 * - `/w/{slug}/tasks?task={taskId}`
 * - `/w/{slug}/sprints`, `/w/{slug}/activity`, `/w/{slug}/archived`
 */
data class DeepLink(
    /** The workspace (Clerk organization) slug; null for the workspace picker. */
    val slug: String?,
    val destination: Destination,
) {
    sealed interface Destination {
        data object Dashboard : Destination

        data class Project(val id: DocumentId, val task: DocumentId?, val comment: DocumentId?) :
            Destination

        data class Tasks(val task: DocumentId?) : Destination

        data object Sprints : Destination

        data object Activity : Destination

        data object Archived : Destination
    }

    companion object {
        const val HOST = "neram.praveenjuge.com"

        /** Same rule as the web's `workspaceHref`. */
        private val slugPattern = Regex("[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?")

        /** Convex IDs; anything else is ignored rather than sent to the server. */
        private val idPattern = Regex("[a-z0-9]{16,64}")

        /**
         * Parses [url], or returns null when it isn't a workspace link on [HOST]. Unknown pages
         * inside a workspace open its dashboard, like the web's fallback.
         */
        fun parse(url: String): DeepLink? {
            val uri =
                try {
                    URI(url)
                } catch (_: URISyntaxException) {
                    return null
                }
            if (uri.scheme != "https" || uri.host?.lowercase() != HOST) return null
            val parts = uri.path.orEmpty().split('/').filter { it.isNotEmpty() }
            if (parts.firstOrNull() != "w") return null
            if (parts.size == 1) return DeepLink(null, Destination.Dashboard)
            val slug = parts[1]
            if (!slugPattern.matches(slug)) return null
            val query = queryIds(uri.rawQuery)
            val destination =
                when (parts.getOrNull(2)) {
                    "projects" -> {
                        val project = parts.getOrNull(3)?.takeIf(idPattern::matches)
                        if (project == null) Destination.Dashboard
                        else {
                            val task = query["task"]
                            // A comment only makes sense with its task.
                            Destination.Project(project, task, task?.let { query["comment"] })
                        }
                    }
                    "tasks" -> Destination.Tasks(query["task"])
                    "sprints" -> Destination.Sprints
                    "activity" -> Destination.Activity
                    "archived" -> Destination.Archived
                    else -> Destination.Dashboard
                }
            return DeepLink(slug, destination)
        }

        /** Query values that are document IDs, first value per name. */
        private fun queryIds(raw: String?): Map<String, DocumentId> =
            raw.orEmpty()
                .split('&')
                .mapNotNull { pair ->
                    val name = pair.substringBefore('=', "")
                    val value = decode(pair.substringAfter('=', "")) ?: return@mapNotNull null
                    if (name.isEmpty() || !idPattern.matches(value)) null else name to value
                }
                .distinctBy { it.first }
                .toMap()

        /** Null for malformed percent-encoding. */
        private fun decode(value: String): String? =
            try {
                URLDecoder.decode(value, "UTF-8")
            } catch (_: IllegalArgumentException) {
                null
            }
    }
}
