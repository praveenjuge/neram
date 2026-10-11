package com.praveenjuge.neram.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Keeps Convex in step with Clerk: which user is signed in and which workspace (Clerk organization)
 * is active.
 */
class AppSession(private val client: NeramClient) {
    sealed interface Phase {
        data object Idle : Phase

        data object Activating : Phase

        /** Convex has opened [workspaceId]. */
        data class Ready(val workspaceId: String) : Phase

        data class Failed(val message: String) : Phase
    }

    private val _phase = MutableStateFlow<Phase>(Phase.Idle)
    val phase: StateFlow<Phase> = _phase.asStateFlow()
    private var signedIn = false
    private val mutex = Mutex()

    /** Tries opening the workspace again after a failure. */
    suspend fun retry(userId: String?, organizationId: String?) {
        _phase.value = Phase.Idle
        update(userId, organizationId)
    }

    /** Call whenever the signed-in user or active organization changes. */
    suspend fun update(userId: String?, organizationId: String?) = mutex.withLock {
        if (userId == null) {
            if (signedIn) client.signOut()
            signedIn = false
            _phase.value = Phase.Idle
            return@withLock
        }
        signedIn = true
        if (organizationId == null) {
            _phase.value = Phase.Idle
            return@withLock
        }
        if (_phase.value == Phase.Ready(organizationId)) return@withLock
        _phase.value = Phase.Activating
        _phase.value =
            try {
                client.activate(organizationId)
                Phase.Ready(organizationId)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: NeramError) {
                Phase.Failed(error.message ?: "Couldn't open this workspace.")
            } catch (error: Exception) {
                Phase.Failed(NeramError.from(error).message ?: "Couldn't open this workspace.")
            }
    }
}
