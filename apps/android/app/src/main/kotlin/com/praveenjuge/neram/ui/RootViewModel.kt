package com.praveenjuge.neram.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clerk.api.Clerk
import com.praveenjuge.neram.data.AppSession
import com.praveenjuge.neram.data.NeramClient
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Signed out → Clerk sign-in. Signed in without a workspace → Clerk's organization list. Otherwise
 * the app, once Convex has opened the workspace Clerk made active (or its saved data while it can't
 * be opened online yet).
 */
@HiltViewModel
class RootViewModel @Inject constructor(private val session: AppSession, client: NeramClient) :
    ViewModel() {
    sealed interface UiState {
        data object Loading : UiState

        data object SignedOut : UiState

        data object ChooseWorkspace : UiState

        data object Opening : UiState

        data class Failed(val message: String) : UiState

        /** [live] is false while showing saved data. */
        data class Ready(val workspaceId: String, val live: Boolean) : UiState
    }

    private data class Identity(val loaded: Boolean, val userId: String?, val workspaceId: String?)

    private val identity =
        combine(Clerk.isInitialized, Clerk.userFlow, Clerk.sessionFlow) { loaded, user, session ->
                Identity(
                    loaded,
                    user?.id,
                    session?.lastActiveOrganizationId?.takeIf { it.isNotBlank() },
                )
            }
            .distinctUntilChanged()

    /** Bumped by Try Again, so the same identity is opened again. */
    private val attempt = MutableStateFlow(0)

    init {
        // A new identity cancels an opening still in progress (it may be waiting for the network).
        viewModelScope.launch {
            combine(identity.filter { it.loaded }, attempt) { identity, _ -> identity }
                .collectLatest { session.update(it.userId, it.workspaceId) }
        }
    }

    val state: StateFlow<UiState> =
        combine(identity, session.phase) { identity, phase ->
                when {
                    !identity.loaded -> UiState.Loading
                    identity.userId == null -> UiState.SignedOut
                    identity.workspaceId == null -> UiState.ChooseWorkspace
                    phase is AppSession.Phase.Ready && phase.workspaceId == identity.workspaceId ->
                        UiState.Ready(phase.workspaceId, phase.live)
                    phase is AppSession.Phase.Failed -> UiState.Failed(phase.message)
                    else -> UiState.Opening
                }
            }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), UiState.Loading)

    val isConnected: StateFlow<Boolean> =
        client.isConnected.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), true)

    fun retry() {
        attempt.value += 1
    }
}
