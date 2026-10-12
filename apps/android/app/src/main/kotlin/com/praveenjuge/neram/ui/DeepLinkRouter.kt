package com.praveenjuge.neram.ui

import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.praveenjuge.neram.data.DeepLink
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Holds the App Link being opened until the app can show it. A link to another workspace switches
 * to it first (the same path as Clerk's switcher), then the main screen opens the page. Mirrors the
 * Apple app's `DeepLinkRouter`.
 */
@Singleton
class DeepLinkRouter @Inject constructor() {
    private val _pending = MutableStateFlow<DeepLink?>(null)
    val pending: StateFlow<DeepLink?> = _pending.asStateFlow()

    private val _problem = MutableStateFlow<String?>(null)
    /** Why the last link couldn't open, shown once. */
    val problem: StateFlow<String?> = _problem.asStateFlow()

    fun open(url: String?) {
        val link = url?.let(DeepLink::parse) ?: return
        _problem.value = null
        // The workspace picker link only brings the app forward.
        _pending.value = link.takeIf { it.slug != null }
    }

    fun dismissProblem() {
        _problem.value = null
    }

    /** Takes the pending link if it belongs to the active workspace, [workspaceId]. */
    fun take(workspaceId: String): DeepLink? {
        val link = _pending.value ?: return null
        if (link.slug == null || link.slug != slugOf(workspaceId)) return null
        _pending.value = null
        return link
    }

    /**
     * Makes [link]'s workspace active when it isn't already. Signed-out users keep the link until
     * they sign in. Runs from a `collectLatest`, so a newer link cancels this one; results for a
     * replaced link are ignored.
     */
    suspend fun switchWorkspaceIfNeeded(link: DeepLink, activeWorkspaceId: String?) {
        val user = Clerk.user ?: return
        val session = Clerk.activeSession ?: return
        val organization =
            user.organizationMemberships
                .orEmpty()
                .map { it.organization }
                .firstOrNull { it.slug == link.slug }
        if (organization == null) {
            fail(link, "You're not a member of that workspace, or it no longer exists.")
            return
        }
        if (organization.id == activeWorkspaceId) return
        val result = Clerk.auth.setActive(session.id, organization.id)
        if (result is ClerkResult.Failure) {
            fail(link, result.throwable?.message ?: "Couldn't switch to that workspace.")
        }
    }

    private fun fail(link: DeepLink, message: String) {
        if (_pending.value != link) return
        _pending.value = null
        _problem.value = message
    }

    private fun slugOf(workspaceId: String) =
        Clerk.user
            ?.organizationMemberships
            .orEmpty()
            .firstOrNull { it.organization.id == workspaceId }
            ?.organization
            ?.slug
}
