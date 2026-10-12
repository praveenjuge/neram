package com.praveenjuge.neram.data

import kotlin.math.min
import kotlin.math.pow
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.dropWhile
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Keeps Convex in step with Clerk: which user is signed in and which workspace (Clerk organization)
 * is active. Call [update] from a single collector that cancels the previous call when the identity
 * changes (`collectLatest`).
 */
class AppSession(private val client: NeramClient) {
    sealed interface Phase {
        data object Idle : Phase

        data object Activating : Phase

        /**
         * [workspaceId] is open. When not [live], it shows saved data while the app keeps trying to
         * open it online.
         */
        data class Ready(val userId: String, val workspaceId: String, val live: Boolean) : Phase

        data class Failed(val message: String) : Phase
    }

    private val _phase = MutableStateFlow<Phase>(Phase.Idle)
    val phase: StateFlow<Phase> = _phase.asStateFlow()
    /** The user whose Convex session and saved data are active, if any. */
    private var userId: String? = null

    suspend fun update(userId: String?, organizationId: String?) {
        // Signed out (also on a cold start after signing out while the app was closed), or another
        // account signed in: drop the previous user's auth and saved data. Saved data is also
        // kept per user, so one account never reads another's.
        if (userId == null || (this.userId != null && userId != this.userId)) {
            client.signOut()
            this.userId = null
            _phase.value = Phase.Idle
        }
        if (userId == null) return
        this.userId = userId
        if (organizationId == null) {
            _phase.value = Phase.Idle
            return
        }
        if (_phase.value == Phase.Ready(userId, organizationId, live = true)) return
        open(userId, organizationId)
    }

    /**
     * Opens the workspace online. With saved data, a slow or failed attempt shows that data
     * instead, and the attempt repeats after a backoff or when the connection comes back.
     */
    private suspend fun open(userId: String, workspaceId: String) {
        val saved = client.hasSavedData(userId, workspaceId)
        _phase.value = Phase.Activating
        var failures = 0
        while (true) {
            try {
                coroutineScope {
                    val fallback =
                        if (saved && _phase.value !is Phase.Ready)
                            launch {
                                delay(SAVED_DATA_AFTER_MS)
                                showSaved(userId, workspaceId)
                            }
                        else null
                    client.activate(userId, workspaceId)
                    fallback?.cancel()
                }
                _phase.value = Phase.Ready(userId, workspaceId, live = true)
                return
            } catch (failure: NeramError) {
                if (failure is NeramError.Server || !saved) {
                    _phase.value = Phase.Failed(message(failure))
                    return
                }
                showSaved(userId, workspaceId)
                failures += 1
                // Wait out the backoff, or until the connection drops and comes back; an
                // already-connected socket doesn't count, or a Clerk outage would retry at once.
                withTimeoutOrNull(retryDelayMs(failures)) {
                    client.isConnected.dropWhile { it }.first { it }
                }
            }
        }
    }

    private fun showSaved(userId: String, workspaceId: String) {
        client.useSavedData(userId, workspaceId)
        _phase.value = Phase.Ready(userId, workspaceId, live = false)
    }

    private fun message(error: NeramError): String =
        if (error !is NeramError.Server && !client.isOnline)
            "You're offline. Connect to the internet to open this workspace."
        else error.message ?: "Couldn't open this workspace."

    companion object {
        const val SAVED_DATA_AFTER_MS = 3_000L

        /** 2, 4, 8 … seconds, capped at 30. */
        fun retryDelayMs(failures: Int): Long =
            (min(30.0, 2.0.pow(min(failures, 5))) * 1000).toLong()
    }
}
