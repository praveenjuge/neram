package com.praveenjuge.neram.ui.tasks

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.praveenjuge.neram.data.Call
import com.praveenjuge.neram.data.Calls
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.NeramError
import com.praveenjuge.neram.data.PagedQuery
import com.praveenjuge.neram.data.Queries
import com.praveenjuge.neram.data.model.CommentAncestry
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.model.Mention
import com.praveenjuge.neram.data.model.TaskComment
import com.praveenjuge.neram.ui.common.ActionState
import com.praveenjuge.neram.ui.common.Live
import com.praveenjuge.neram.ui.common.asLive
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * A task's comments and their live queries, owned by the task's view model. Lazy rows come and go
 * as they scroll, so nothing long-lived hangs off them: replies and the linked thread run here.
 */
class TaskComments(
    val taskId: DocumentId,
    targetId: DocumentId?,
    private val client: NeramClient,
    private val scope: CoroutineScope,
) {
    val roots = PagedQuery(pageSize = 20) { Queries.comments(taskId, it) }
    private val replies = mutableMapOf<DocumentId, PagedQuery<TaskComment>>()
    /** The linked comment's thread, when the task was opened at a comment. */
    val linked = targetId?.let { LinkedThread(it, client, scope) }
    val action = ActionState()

    init {
        scope.launch { roots.run(client) }
    }

    /** A comment's replies, ten at a time; started on first use and kept live after. */
    fun replies(parentId: DocumentId): PagedQuery<TaskComment> =
        replies.getOrPut(parentId) {
            PagedQuery(pageSize = 10) { Queries.comments(taskId, it, parentId) }
                .also { query -> scope.launch { query.run(client) } }
        }

    fun create(body: String, mentions: List<Mention>, onDone: (Boolean) -> Unit) =
        send(Calls.createComment(taskId, body, mentions), onDone)

    fun reply(
        parent: TaskComment,
        body: String,
        mentions: List<Mention>,
        onDone: (Boolean) -> Unit,
    ) = send(Calls.replyToComment(parent.id, body, mentions), onDone)

    fun edit(
        comment: TaskComment,
        body: String,
        mentions: List<Mention>,
        onDone: (Boolean) -> Unit,
    ) = send(Calls.editComment(comment.id, body, mentions), onDone)

    fun delete(comment: TaskComment) = send(Calls.removeComment(comment.id)) {}

    /** Finishes even if the task screen closes meanwhile, so a posted comment is never dropped. */
    private fun send(call: Call<*>, onDone: (Boolean) -> Unit) {
        scope.launch { onDone(action.run { withContext(NonCancellable) { client.run(call) } }) }
    }
}

/**
 * The chain from a linked comment's root down to it, kept live while the task is open, like the
 * web. Very deep chains load older comments in pages of 100 when asked.
 */
class LinkedThread(
    val targetId: DocumentId,
    private val client: NeramClient,
    private val scope: CoroutineScope,
) {
    private class Page {
        var state by mutableStateOf<Live<CommentAncestry>>(Live.Loading)
        var job: Job? = null
    }

    /** Nearest page first; each later page holds older comments. */
    private val pages = mutableStateListOf<Page>()

    init {
        retry()
    }

    fun retry() {
        pages.forEach { it.job?.cancel() }
        pages.clear()
        add(start = null)
    }

    fun showOlder() {
        val older = loaded(pages.lastOrNull())?.nextCommentId ?: return
        add(start = older)
    }

    /** Root first, down to the linked comment. */
    val comments: List<TaskComment>
        get() = pages.reversed().flatMap { loaded(it)?.comments.orEmpty() }

    val taskId: DocumentId?
        get() = loaded(pages.firstOrNull())?.taskId

    val isLoaded: Boolean
        get() = loaded(pages.firstOrNull()) != null

    val isLoading: Boolean
        get() = pages.any { it.state == Live.Loading }

    val hasOlder: Boolean
        get() = loaded(pages.lastOrNull())?.nextCommentId != null

    val error: NeramError?
        get() = pages.firstNotNullOfOrNull { (it.state as? Live.Failed)?.error }

    private fun loaded(page: Page?) = (page?.state as? Live.Loaded)?.value

    private fun add(start: DocumentId?) {
        val page = Page()
        pages += page
        page.job = scope.launch {
            client.observe(Queries.commentAncestry(targetId, start, limit = 100)).asLive().collect {
                page.state = it
            }
        }
    }
}
