package com.praveenjuge.neram.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.clerk.ui.organizationswitcher.OrganizationSwitcher
import com.clerk.ui.organizationswitcher.OrganizationSwitcherDisplayMode
import com.clerk.ui.userbutton.UserButton

/** A top-level screen: title, workspace switcher, and the account button, like the web's shell. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopLevelScreen(title: String, content: @Composable (PaddingValues) -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                // Clerk's switcher and account button fill the height they're given, so both get a
                // fixed
                // box; otherwise they stretch the bar and push the title out.
                navigationIcon = {
                    Box(Modifier.padding(start = 12.dp).size(40.dp)) {
                        OrganizationSwitcher(
                            hidePersonal = true,
                            displayMode = OrganizationSwitcherDisplayMode.Compact,
                        )
                    }
                },
                title = { Text(title) },
                actions = { Box(Modifier.padding(end = 12.dp).size(40.dp)) { UserButton() } },
            )
        },
        content = content,
    )
}

/** Loading, error, and loaded states for a [Live] value. */
@Composable
fun <T> LiveContent(live: Live<T>, padding: PaddingValues, content: @Composable (T) -> Unit) {
    when (live) {
        Live.Loading ->
            Box(Modifier.fillMaxSize().padding(padding), Alignment.Center) {
                CircularProgressIndicator()
            }
        is Live.Failed ->
            Message(padding, "Couldn't load this", live.error.message ?: "Something went wrong.")
        is Live.Loaded -> content(live.value)
    }
}

/** A centered title and explanation, for empty and error states. */
@Composable
fun Message(padding: PaddingValues, title: String, body: String) {
    Box(Modifier.fillMaxSize().padding(padding).padding(24.dp), Alignment.Center) {
        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(
                body,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
