package com.praveenjuge.neram.ui.activity

import android.text.format.DateUtils
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.automirrored.outlined.Reply
import androidx.compose.material.icons.outlined.AddCircleOutline
import androidx.compose.material.icons.outlined.AlternateEmail
import androidx.compose.material.icons.outlined.ArrowCircleRight
import androidx.compose.material.icons.outlined.AssignmentInd
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.EventRepeat
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.PersonRemove
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Replay
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.PagedQuery
import com.praveenjuge.neram.data.Queries
import com.praveenjuge.neram.data.model.ActivityItem
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.ui.common.LocalWorkspaceViewModelStoreOwner
import com.praveenjuge.neram.ui.common.Message
import com.praveenjuge.neram.ui.common.TopLevelScreen
import com.praveenjuge.neram.ui.common.pageFooter
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

/** Workspace history, newest first. Rows about a task open it. */
@Composable
fun ActivityScreen(
    /** Opens a task, at the comment the row is about when there is one. */
    onOpenTask: (task: DocumentId, comment: DocumentId?) -> Unit,
    viewModel: ActivityViewModel = hiltViewModel(LocalWorkspaceViewModelStoreOwner.current),
) {
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
                    items(state.items, key = { it.id }) { item ->
                        // Only rows about a task in a project link somewhere, as on the web.
                        val taskId = item.taskId?.takeIf { item.projectId != null }
                        ActivityRow(
                            item,
                            if (taskId == null) Modifier
                            else Modifier.clickable { onOpenTask(taskId, item.commentId) },
                        )
                    }
                    pageFooter(
                        state,
                        viewModel::loadMore,
                        "Older activity loads when you're back online.",
                    )
                }
        }
    }
}

@Composable
private fun ActivityRow(item: ActivityItem, modifier: Modifier) {
    val context =
        item.projectName ?: item.sprintNumber?.let { "Sprint ${it.toInt()}" } ?: "Workspace"
    val time =
        // The server's clock can run slightly ahead; never say "in 0 minutes".
        System.currentTimeMillis().let { now ->
            DateUtils.getRelativeTimeSpanString(
                item.createdAt.toLong().coerceAtMost(now),
                now,
                DateUtils.MINUTE_IN_MILLIS,
            )
        }
    ListItem(
        modifier = modifier,
        leadingContent = {
            Icon(
                item.icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        },
        supportingContent = {
            Column {
                item.commentExcerpt?.let {
                    Text("“$it”", maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                Text("$context · $time", style = MaterialTheme.typography.labelMedium)
            }
        },
    ) {
        Text(
            buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append(item.actorName) }
                append(" ${item.action}")
            }
        )
    }
}

/** Matches the icon per event type on the web. */
private val ActivityItem.icon: ImageVector
    get() =
        when (type) {
            "task.created" -> Icons.Outlined.AddCircleOutline
            "task.moved" -> Icons.Outlined.ArrowCircleRight
            "task.assigned" -> Icons.Outlined.AssignmentInd
            "task.deleted" -> Icons.Outlined.Delete
            "project.updated" -> Icons.Outlined.Edit
            "member.joined" -> Icons.Outlined.PersonAdd
            "member.left" -> Icons.AutoMirrored.Outlined.Logout
            "member.removed" -> Icons.Outlined.PersonRemove
            "comment.mentioned" -> Icons.Outlined.AlternateEmail
            "comment.replied" -> Icons.AutoMirrored.Outlined.Reply
            "sprint.started" -> Icons.Outlined.PlayArrow
            "sprint.ended" -> Icons.Outlined.History
            "sprint.rolled_over",
            "sprint.early_closed" -> Icons.Outlined.Replay
            else -> Icons.Outlined.EventRepeat
        }
