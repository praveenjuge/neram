package com.praveenjuge.neram.ui.tasks

import android.text.format.DateUtils
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.praveenjuge.neram.data.MentionText
import com.praveenjuge.neram.data.NeramError
import com.praveenjuge.neram.data.PagedQuery
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.model.Member
import com.praveenjuge.neram.data.model.TaskComment
import com.praveenjuge.neram.ui.common.ConfirmDialog
import com.praveenjuge.neram.ui.common.UserAvatar
import com.praveenjuge.neram.ui.common.pageFooter
import com.praveenjuge.neram.ui.common.rememberHoldingSheetState
import kotlinx.coroutines.launch

/** What every comment in a task needs to render and act. */
class CommentContext(
    val comments: TaskComments,
    val currentSubject: String?,
    val isAdmin: Boolean,
    val enabled: Boolean,
    val onReply: (TaskComment) -> Unit,
    val onEdit: (TaskComment) -> Unit,
)

/** A comment being replied to or edited in a sheet. */
sealed interface CommentSheet {
    data class Reply(val parent: TaskComment) : CommentSheet

    data class Edit(val comment: TaskComment) : CommentSheet
}

private fun linkedCommentKey(commentId: DocumentId) = "linked-$commentId"

/**
 * The list index of the linked comment's row, for scrolling to it, when [linkedThreadSection]
 * starts at [sectionStart]. Mirrors that section's items: a header, then a loading or "Show
 * earlier" row, then the chain.
 */
fun linkedCommentIndex(linked: LinkedThread, sectionStart: Int): Int? {
    val position = linked.comments.indexOfFirst { it.id == linked.targetId }
    if (position < 0) return null
    val extra = if (linked.isLoading || linked.hasOlder) 1 else 0
    return sectionStart + 1 + extra + position
}

/**
 * The linked comment's thread, when the task was opened at one: the chain from its root down to it,
 * highlighted, with its replies.
 */
fun LazyListScope.linkedThreadSection(context: CommentContext) {
    val linked = context.comments.linked ?: return
    item(key = "linked-header") { SectionTitle("Linked thread") }
    val linkedTask = linked.taskId
    if (linkedTask != null && linkedTask != context.comments.taskId) {
        item(key = "linked-unavailable") { Note("Linked comment unavailable.") }
        return
    }
    if (linked.isLoading) {
        item(key = "linked-loading") { Progress() }
    } else if (linked.hasOlder) {
        item(key = "linked-older") {
            TextButton(
                onClick = linked::showOlder,
                modifier = Modifier.padding(horizontal = 8.dp),
            ) {
                Text("Show earlier comments")
            }
        }
    }
    val chain = linked.comments
    items(chain.size, key = { linkedCommentKey(chain[it].id) }) { index ->
        val comment = chain[index]
        Box(Modifier.padding(start = 16.dp + 12.dp * index.coerceAtMost(3), end = 16.dp)) {
            CommentNode(
                comment,
                depth = index,
                context = context,
                highlighted = comment.id == linked.targetId,
                showsReplies = comment.id == linked.targetId,
            )
        }
    }
    linked.error?.let { error -> item(key = "linked-error") { LoadError(error, linked::retry) } }
}

/** The task's comments: a composer, then threads whose replies load in pages. */
fun LazyListScope.commentsSection(
    context: CommentContext,
    members: List<Member>,
    roots: PagedQuery.State<TaskComment>,
) {
    val comments = context.comments
    item(key = "comments-header") { SectionTitle("Comments") }
    item(key = "comments-composer") {
        CommentComposer(
            members,
            enabled = context.enabled,
            running = comments.action.running,
            onSubmit = comments::create,
            modifier = Modifier.padding(horizontal = 16.dp),
        )
    }
    val error = roots.error
    when {
        error != null && roots.items.isEmpty() ->
            item(key = "comments-error") { LoadError(error, comments.roots::retry) }
        roots.status == PagedQuery.Status.LoadingFirstPage ->
            item(key = "comments-loading") { Progress() }
        roots.items.isEmpty() -> item(key = "comments-empty") { Note("No comments yet.") }
    }
    items(roots.items, key = { "comment-${it.id}" }) { comment ->
        Box(Modifier.padding(horizontal = 16.dp)) { CommentNode(comment, depth = 0, context) }
    }
    pageFooter(roots, comments.roots::loadMore, "Older comments load when you're back online.")
}

/**
 * One comment and, below it, its replies. Indentation stops after three levels, as on the web.
 * Authors edit their comments; authors and admins delete them.
 */
@Composable
private fun CommentNode(
    comment: TaskComment,
    depth: Int,
    context: CommentContext,
    highlighted: Boolean = false,
    showsReplies: Boolean = true,
) {
    val canEdit = !comment.isDeleted && comment.authorSubject == context.currentSubject
    val canDelete = !comment.isDeleted && (canEdit || context.isAdmin)
    var confirmingDelete by remember { mutableStateOf(false) }
    val highlight = MaterialTheme.colorScheme.primaryContainer

    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Row(
            Modifier.fillMaxWidth()
                .background(
                    if (highlighted) highlight else MaterialTheme.colorScheme.surface,
                    RoundedCornerShape(8.dp),
                )
                .padding(6.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            UserAvatar(comment.authorName, Modifier.padding(top = 2.dp), size = 28.dp)
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CommentHeader(comment, Modifier.weight(1f))
                    if (canEdit || canDelete) {
                        CommentMenu(
                            canEdit,
                            canDelete,
                            context.enabled,
                            onEdit = { context.onEdit(comment) },
                            onDelete = { confirmingDelete = true },
                        )
                    }
                }
                CommentBody(comment)
                TextButton(
                    onClick = { context.onReply(comment) },
                    enabled = context.enabled,
                    contentPadding = PaddingValues(0.dp),
                ) {
                    Text("Reply", style = MaterialTheme.typography.labelMedium)
                }
            }
        }
        if (showsReplies) {
            val line = MaterialTheme.colorScheme.outlineVariant
            Box(
                if (depth < 3)
                    Modifier.padding(start = 14.dp).drawBehind {
                        drawLine(line, Offset(-8.dp.toPx(), 0f), Offset(-8.dp.toPx(), size.height))
                    }
                else Modifier
            ) {
                CommentReplies(comment, depth + 1, context)
            }
        }
    }
    if (confirmingDelete) {
        ConfirmDialog(
            title = "Delete this comment?",
            message = "Replies stay, and the comment shows as deleted.",
            confirmLabel = "Delete Comment",
            onConfirm = { context.comments.delete(comment) },
            onDismiss = { confirmingDelete = false },
        )
    }
}

@Composable
private fun CommentHeader(comment: TaskComment, modifier: Modifier) {
    val time =
        // The server's clock can run slightly ahead; never say "in 0 minutes".
        System.currentTimeMillis().let { now ->
            DateUtils.getRelativeTimeSpanString(
                comment.createdAt.toLong().coerceAtMost(now),
                now,
                DateUtils.MINUTE_IN_MILLIS,
            )
        }
    Text(
        buildAnnotatedString {
            withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append(comment.authorName) }
            withStyle(SpanStyle(color = MaterialTheme.colorScheme.onSurfaceVariant)) {
                if (comment.isEdited && !comment.isDeleted) append(" · edited")
                append(" · $time")
            }
        },
        style = MaterialTheme.typography.bodyMedium,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = modifier,
    )
}

@Composable
private fun CommentMenu(
    canEdit: Boolean,
    canDelete: Boolean,
    enabled: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Box {
        var open by remember { mutableStateOf(false) }
        IconButton(onClick = { open = true }, enabled = enabled) {
            Icon(Icons.Outlined.MoreVert, contentDescription = "Comment actions")
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            if (canEdit) {
                DropdownMenuItem(
                    text = { Text("Edit") },
                    leadingIcon = { Icon(Icons.Outlined.Edit, null) },
                    onClick = {
                        open = false
                        onEdit()
                    },
                )
            }
            if (canDelete) {
                DropdownMenuItem(
                    text = { Text("Delete") },
                    leadingIcon = { Icon(Icons.Outlined.Delete, null) },
                    onClick = {
                        open = false
                        onDelete()
                    },
                )
            }
        }
    }
}

/** A comment's text with mentions emphasized, or a deleted placeholder. */
@Composable
private fun CommentBody(comment: TaskComment, maxLines: Int = Int.MAX_VALUE) {
    if (comment.isDeleted) {
        Text(
            "Comment deleted",
            fontStyle = FontStyle.Italic,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    } else {
        Text(
            mentionText(comment, MaterialTheme.colorScheme.primary),
            maxLines = maxLines,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

private fun mentionText(comment: TaskComment, color: Color) = buildAnnotatedString {
    MentionText.segments(comment.body, comment.mentions).forEach { segment ->
        when (segment) {
            is MentionText.Segment.Text -> append(segment.text)
            is MentionText.Segment.Tag ->
                withStyle(SpanStyle(color = color, fontWeight = FontWeight.Medium)) {
                    append("@${segment.mention.label}")
                }
        }
    }
}

/** A comment's replies, ten at a time. */
@Composable
private fun CommentReplies(parent: TaskComment, depth: Int, context: CommentContext) {
    val query = remember(parent.id) { context.comments.replies(parent.id) }
    val replies by query.state.collectAsStateWithLifecycle()
    Column {
        val error = replies.error
        if (error != null && replies.items.isEmpty()) LoadError(error, query::retry)
        replies.items.forEach { reply -> CommentNode(reply, depth, context) }
        when (replies.status) {
            PagedQuery.Status.CanLoadMore ->
                TextButton(onClick = query::loadMore) { Text("Load more replies") }
            PagedQuery.Status.LoadingMore -> CircularProgressIndicator(Modifier.width(20.dp))
            else -> {}
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleSmall,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp),
    )
}

@Composable
private fun Note(text: String) {
    Text(
        text,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
    )
}

@Composable
private fun Progress() {
    Box(Modifier.fillMaxWidth().padding(16.dp), Alignment.Center) { CircularProgressIndicator() }
}

/** A failed load, with a way to try again. */
@Composable
private fun LoadError(error: NeramError, retry: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            error.message ?: "Couldn't load comments.",
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.weight(1f),
        )
        TextButton(onClick = retry) { Text("Try Again") }
    }
}

/** Reply to or edit a comment. The sheet stays open while it saves and closes once it has. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommentEditorSheet(
    sheet: CommentSheet,
    comments: TaskComments,
    members: List<Member>,
    enabled: Boolean,
    onDismiss: () -> Unit,
) {
    val running = comments.action.running
    val state = rememberHoldingSheetState { running }
    val scope = rememberCoroutineScope()
    val close: () -> Unit = { scope.launch { state.hide() }.invokeOnCompletion { onDismiss() } }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = state) {
        Column(
            Modifier.fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            when (sheet) {
                is CommentSheet.Reply -> {
                    Text(
                        "Replying to ${sheet.parent.authorName}",
                        style = MaterialTheme.typography.titleMedium,
                    )
                    CommentBody(sheet.parent, maxLines = 4)
                    CommentComposer(
                        members,
                        enabled,
                        running,
                        onSubmit = { body, mentions, done ->
                            comments.reply(sheet.parent, body, mentions) { saved ->
                                done(saved)
                                if (saved) close()
                            }
                        },
                        placeholder = "Reply to ${sheet.parent.authorName}…",
                        autoFocus = true,
                        onCancel = close,
                    )
                }
                is CommentSheet.Edit -> {
                    Text("Edit Comment", style = MaterialTheme.typography.titleMedium)
                    CommentComposer(
                        members,
                        enabled,
                        running,
                        onSubmit = { body, mentions, done ->
                            comments.edit(sheet.comment, body, mentions) { saved ->
                                done(saved)
                                if (saved) close()
                            }
                        },
                        initialBody = sheet.comment.body,
                        initialMentions = sheet.comment.mentions,
                        autoFocus = true,
                        onCancel = close,
                    )
                }
            }
        }
    }
}
