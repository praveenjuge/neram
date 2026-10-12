package com.praveenjuge.neram.ui.activity

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.PagedQuery
import com.praveenjuge.neram.data.Queries
import com.praveenjuge.neram.data.model.ActivityItem
import com.praveenjuge.neram.ui.common.Message
import com.praveenjuge.neram.ui.common.TopLevelScreen
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch

@HiltViewModel
class ActivityViewModel @Inject constructor(client: NeramClient) : ViewModel() {
    private val feed = PagedQuery(pageSize = 30) { Queries.activity(it) }
    val state = feed.state

    init {
        viewModelScope.launch { feed.run(client) }
    }

    fun loadMore() = feed.loadMore()

    fun retry() = feed.retry()
}

/** Workspace history, newest first. */
@Composable
fun ActivityScreen(viewModel: ActivityViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    TopLevelScreen("Activity") { padding ->
        val error = state.error
        when {
            error != null && state.items.isEmpty() ->
                Message(
                    padding,
                    "Couldn't load activity",
                    error.message ?: "Something went wrong.",
                    viewModel::retry,
                )
            state.status == PagedQuery.Status.LoadingFirstPage ->
                Box(Modifier.fillMaxWidth().padding(padding).padding(24.dp), Alignment.Center) {
                    CircularProgressIndicator()
                }
            state.items.isEmpty() ->
                Message(
                    padding,
                    "No activity yet",
                    "Actions across this workspace will show up here.",
                )
            else ->
                LazyColumn(contentPadding = padding) {
                    items(state.items, key = { it.id }) { item -> ActivityRow(item) }
                    if (
                        state.status == PagedQuery.Status.CanLoadMore ||
                            state.status == PagedQuery.Status.LoadingMore
                    ) {
                        item(key = "footer") {
                            // Requests the next page when the footer scrolls into view.
                            LaunchedEffect(state.status) {
                                if (state.status == PagedQuery.Status.CanLoadMore)
                                    viewModel.loadMore()
                            }
                            Box(Modifier.fillMaxWidth().padding(16.dp), Alignment.Center) {
                                CircularProgressIndicator()
                            }
                        }
                    }
                    if (state.status == PagedQuery.Status.SavedOnly) {
                        item(key = "saved") {
                            Text(
                                "Older activity loads when you're back online.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                            )
                        }
                    }
                }
        }
    }
}

@Composable
private fun ActivityRow(item: ActivityItem) {
    val context =
        item.projectName ?: item.sprintNumber?.let { "Sprint ${it.toInt()}" } ?: "Workspace"
    ListItem(supportingContent = { Text(context) }) { Text("${item.actorName} ${item.action}") }
}
