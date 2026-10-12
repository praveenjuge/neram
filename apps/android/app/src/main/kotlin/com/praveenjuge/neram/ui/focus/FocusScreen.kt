package com.praveenjuge.neram.ui.focus

import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ListItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.Queries
import com.praveenjuge.neram.ui.common.LiveContent
import com.praveenjuge.neram.ui.common.LiveQuery
import com.praveenjuge.neram.ui.common.Message
import com.praveenjuge.neram.ui.common.TopLevelScreen
import com.praveenjuge.neram.ui.tasks.TaskListItem
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class FocusViewModel @Inject constructor(client: NeramClient) : ViewModel() {
    val current = LiveQuery(viewModelScope) { client.observe(Queries.currentSprint) }
}

/** The optional Sprint: one shared focus list across projects. */
@Composable
fun FocusScreen(viewModel: FocusViewModel = hiltViewModel()) {
    val current by viewModel.current.state.collectAsStateWithLifecycle()
    TopLevelScreen("Focus") { padding ->
        LiveContent(current, padding, viewModel.current::retry) { sprint ->
            if (sprint == null) {
                Message(
                    padding,
                    "Choose what matters now",
                    "Start an optional Sprint with an empty focus list. Your projects and Backlog keep " +
                        "working even when no Sprint is active.",
                )
            } else {
                LazyColumn(contentPadding = padding) {
                    item {
                        ListItem(
                            supportingContent = { Text(sprint.sprint.goal ?: "No goal yet") }
                        ) {
                            Text("Sprint ${sprint.sprint.number.toInt()}")
                        }
                    }
                    items(sprint.tasks, key = { it.id }) { task -> TaskListItem(task) }
                }
            }
        }
    }
}
