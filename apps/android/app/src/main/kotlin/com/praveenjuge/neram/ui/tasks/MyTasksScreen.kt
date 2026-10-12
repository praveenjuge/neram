package com.praveenjuge.neram.ui.tasks

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
import com.praveenjuge.neram.data.model.TaskItem
import com.praveenjuge.neram.ui.common.LiveContent
import com.praveenjuge.neram.ui.common.LiveQuery
import com.praveenjuge.neram.ui.common.Message
import com.praveenjuge.neram.ui.common.TopLevelScreen
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class MyTasksViewModel @Inject constructor(client: NeramClient) : ViewModel() {
    val tasks = LiveQuery(viewModelScope) { client.observe(Queries.allTasks(assignedToMe = true)) }
}

/** Tasks assigned to you across every project. */
@Composable
fun MyTasksScreen(viewModel: MyTasksViewModel = hiltViewModel()) {
    val tasks by viewModel.tasks.state.collectAsStateWithLifecycle()
    TopLevelScreen("My Tasks") { padding ->
        LiveContent(tasks, padding, viewModel.tasks::retry) { list ->
            if (list.isEmpty()) {
                Message(
                    padding,
                    "Nothing assigned to you",
                    "Tasks across your projects show up here.",
                )
            } else {
                LazyColumn(contentPadding = padding) {
                    items(list, key = { it.id }) { task -> TaskListItem(task) }
                }
            }
        }
    }
}

@Composable
fun TaskListItem(task: TaskItem) {
    ListItem(
        supportingContent = {
            Text(listOfNotNull(task.status.label, task.projectName).joinToString(" · "))
        }
    ) {
        Text(task.title)
    }
}
