package com.praveenjuge.neram.data

import kotlin.math.min
import kotlin.math.pow
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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
        data class Ready(val workspaceId: String, val live: Boolean) : Phase

        data class Failed(val message: String) : Phase
    }

    private val _phase = MutableStateFlow<Phase>(Phase.Idle)
    val phase: StateFlow<Phase> = _phase.asStateFlow()
    private var signedIn = false

    suspend fun update(userId: String?, organizationId: String?) {
        if (userId == null) {
            if (signedIn) client.signOut()
            signedIn = false
            _phase.value = Phase.Idle
            return
        }
        signedIn = true
        if (organizationId == null) {
            _phase.value = Phase.Idle
            return
        }
        if (_phase.value == Phase.Ready(organizationId, live = true)) return
        open(organizationId)
    }

    /**
     * Opens the workspace online. With saved data, a slow or failed attempt shows that data
     * instead, and the attempt repeats when the connection returns.
     */
    private suspend fun open(workspaceId: String) {
        val saved = client.hasSavedData(workspaceId)
        _phase.value = Phase.Activating
        var failures = 0
        while (true) {
            try {
                coroutineScope {
                    val fallback =
                        if (saved && _phase.value !is Phase.Ready)
                            launch {
                                delay(SAVED_DATA_AFTER_MS)
                                showSaved(workspaceId)
                            }
                        else null
                    client.activate(workspaceId)
                    fallback?.cancel()
                }
                _phase.value = Phase.Ready(workspaceId, live = true)
                return
            } catch (failure: NeramError) {
                if (failure is NeramError.Server || !saved) {
                    _phase.value = Phase.Failed(message(failure))
                    return
                }
                showSaved(workspaceId)
                failures += 1
                withTimeoutOrNull(retryDelayMs(failures)) { client.isConnected.first { it } }
            }
        }
    }

    private fun showSaved(workspaceId: String) {
        client.useSavedData(workspaceId)
        _phase.value = Phase.Ready(workspaceId, live = false)
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
