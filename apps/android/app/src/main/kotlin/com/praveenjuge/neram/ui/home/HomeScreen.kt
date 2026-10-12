package com.praveenjuge.neram.ui.home

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
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(client: NeramClient) : ViewModel() {
    val projects = LiveQuery(viewModelScope) { client.observe(Queries.projects) }
}

/** The dashboard: every active project, newest activity first. */
@Composable
fun HomeScreen(viewModel: HomeViewModel = hiltViewModel()) {
    val projects by viewModel.projects.state.collectAsStateWithLifecycle()
    TopLevelScreen("Projects") { padding ->
        LiveContent(projects, padding, viewModel.projects::retry) { list ->
            if (list.isEmpty()) {
                Message(
                    padding,
                    "No projects yet",
                    "Create your first project to open a kanban board.",
                )
            } else {
                LazyColumn(contentPadding = padding) {
                    items(list, key = { it.id }) { project ->
                        ListItem(
                            supportingContent = {
                                Text(
                                    "${project.todoCount.toInt()} Todo · ${project.inProgressCount.toInt()} In Progress"
                                )
                            }
                        ) {
                            Text(project.name)
                        }
                    }
                }
            }
        }
    }
}
