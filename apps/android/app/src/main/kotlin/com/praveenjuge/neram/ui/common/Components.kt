package com.praveenjuge.neram.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.clerk.ui.organizationswitcher.OrganizationSwitcher
import com.clerk.ui.organizationswitcher.OrganizationSwitcherDisplayMode
import com.clerk.ui.userbutton.UserButton
import com.praveenjuge.neram.data.PagedQuery

/**
 * A top-level screen: title, workspace switcher, and the account button, like the web's shell.
 * [actions] go before the account button.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopLevelScreen(
    title: String,
    actions: @Composable RowScope.() -> Unit = {},
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                // Clerk's switcher and account button fill the height they're given, so both get
                // a fixed box; otherwise they stretch the bar and push the title out.
                navigationIcon = {
                    Box(Modifier.padding(start = 12.dp).size(40.dp)) {
                        OrganizationSwitcher(
                            hidePersonal = true,
                            displayMode = OrganizationSwitcherDisplayMode.Compact,
                        )
                    }
                },
                title = { Text(title) },
                actions = {
                    actions()
                    Box(Modifier.padding(end = 12.dp).size(40.dp)) { UserButton() }
                },
            )
        },
        content = content,
    )
}

/** A pushed screen with a back button. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailScreen(
    title: String,
    onBack: () -> Unit,
    actions: @Composable RowScope.() -> Unit = {},
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                    }
                },
                title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                actions = actions,
            )
        },
        content = content,
    )
}

/**
 * The end of a paged list: requests the next page when it scrolls into view, and explains when only
 * saved pages are available offline.
 */
fun <T> LazyListScope.pageFooter(
    state: PagedQuery.State<T>,
    loadMore: () -> Unit,
    savedNote: String,
) {
    when (state.status) {
        PagedQuery.Status.CanLoadMore,
        PagedQuery.Status.LoadingMore ->
            item(key = "footer") {
                LaunchedEffect(state.status) {
                    if (state.status == PagedQuery.Status.CanLoadMore) loadMore()
                }
                Box(Modifier.fillMaxWidth().padding(16.dp), Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
        PagedQuery.Status.SavedOnly ->
            item(key = "saved") {
                Text(
                    savedNote,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                )
            }
        else -> {}
    }
}

/** Loading, error, and loaded states for a [Live] value. */
@Composable
fun <T> LiveContent(
    live: Live<T>,
    padding: PaddingValues,
    onRetry: () -> Unit,
    content: @Composable (T) -> Unit,
) {
    when (live) {
        Live.Loading ->
            Box(Modifier.fillMaxSize().padding(padding), Alignment.Center) {
                CircularProgressIndicator()
            }
        is Live.Failed ->
            Message(
                padding,
                "Couldn't load this",
                live.error.message ?: "Something went wrong.",
                onRetry,
            )
        is Live.Loaded -> content(live.value)
    }
}

/** A centered title and explanation, for empty and error states, with Try Again for errors. */
@Composable
fun Message(padding: PaddingValues, title: String, body: String, onRetry: (() -> Unit)? = null) {
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
            if (onRetry != null) Button(onClick = onRetry) { Text("Try Again") }
        }
    }
}
