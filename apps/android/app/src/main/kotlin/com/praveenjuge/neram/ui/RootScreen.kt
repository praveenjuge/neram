package com.praveenjuge.neram.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clerk.ui.auth.AuthView
import com.clerk.ui.organizationlist.OrganizationListView
import com.clerk.ui.organizationswitcher.OrganizationSwitcher
import com.clerk.ui.userbutton.UserButton
import com.praveenjuge.neram.ui.common.WorkspaceScope

@Composable
fun RootScreen(viewModel: RootViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val isConnected by viewModel.isConnected.collectAsStateWithLifecycle()
    Surface(Modifier.fillMaxSize()) {
        when (val current = state) {
            RootViewModel.UiState.Loading -> Progress()
            RootViewModel.UiState.SignedOut -> AuthView(isDismissible = false)
            RootViewModel.UiState.ChooseWorkspace ->
                OrganizationListView(
                    modifier = Modifier.safeDrawingPadding(),
                    hidePersonalAccount = true,
                    isDismissible = false,
                    skipPostCreateInviteFlow = true,
                )
            RootViewModel.UiState.Opening -> Progress("Opening your workspace…")
            is RootViewModel.UiState.Failed ->
                WorkspaceUnavailable(current.message, viewModel::retry)
            // Each user and workspace, and the switch from saved to live data, gets fresh screens
            // and view
            // models, so every query subscribes again with the current workspace's auth.
            is RootViewModel.UiState.Ready -> WorkspaceScope(current) { MainScaffold(isConnected) }
        }
    }
}

@Composable
private fun Progress(label: String? = null) {
    Column(
        Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator()
        if (label != null) Text(label, style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun WorkspaceUnavailable(message: String, retry: () -> Unit) {
    Box(Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp), Alignment.Center) {
        Column(
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Couldn't open this workspace", style = MaterialTheme.typography.titleLarge)
            Text(message, textAlign = TextAlign.Center)
            Button(onClick = retry) { Text("Try Again") }
            OrganizationSwitcher(hidePersonal = true)
            UserButton()
        }
    }
}
