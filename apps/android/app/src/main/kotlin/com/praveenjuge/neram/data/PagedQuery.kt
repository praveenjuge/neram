package com.praveenjuge.neram.data

import com.praveenjuge.neram.data.model.Page
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * A live, growing list over a Convex paginated query, like convex-js `usePaginatedQuery`.
 *
 * Each page is its own subscription. When a later page is requested, the page before it is
 * re-subscribed with `endCursor` pinned to where it ended, so inserts and deletes never shift items
 * between pages (no duplicates or gaps). A page the server asks to split is replaced by two pinned
 * halves. If a later page fails (for example a cursor became invalid), the list restarts from the
 * first page.
 *
 * All methods must be called from the coroutine running [run] (the main thread in the app).
 */
class PagedQuery<T>(
    private val pageSize: Int = 20,
    /** Keep requesting pages until the list is exhausted, for small sets like members. */
    private val loadsAllPages: Boolean = false,
    private val makeQuery: (PageRequest) -> Query<Page<T>>,
) {
    enum class Status {
        LoadingFirstPage,
        LoadingMore,
        CanLoadMore,
        Exhausted,
    }

    data class State<T>(
        val items: List<T> = emptyList(),
        val status: Status = Status.LoadingFirstPage,
        val error: NeramError? = null,
    )

    private val _state = MutableStateFlow(State<T>())
    val state: StateFlow<State<T>> = _state.asStateFlow()

    private class Slot<T>(val id: Int, val request: PageRequest, var result: Page<T>? = null) {
        var job: Job? = null
    }

    private val slots = mutableListOf<Slot<T>>()
    private var nextSlotId = 0
    private var client: NeramClient? = null
    private var scope: CoroutineScope? = null

    /** Keeps the list live until the calling coroutine is cancelled. */
    suspend fun run(client: NeramClient) {
        coroutineScope {
            this@PagedQuery.client = client
            this@PagedQuery.scope = this
            try {
                restart()
                awaitCancellation()
            } finally {
                stopAll()
                this@PagedQuery.scope = null
            }
        }
    }

    /** Requests the next page once the current last page has loaded. */
    fun loadMore() {
        val last = slots.lastOrNull() ?: return
        val result = last.result ?: return
        if (_state.value.status != Status.CanLoadMore) return
        // Pin the current last page so the new page starts exactly where it ends.
        if (last.request.endCursor == null) {
            replace(
                slots.lastIndex,
                listOf(PageRequest(pageSize, last.request.cursor, result.continueCursor)),
                keeping = result,
            )
        }
        append(PageRequest(pageSize, result.continueCursor))
        publish()
    }

    /** Starts over from the first page, for example after a failed load. */
    fun retry() {
        restart()
    }

    // Slot changes don't publish; each entry point publishes once when its slots are consistent.
    // Publishing midway could start another loadMore from the same cursor while the last page is
    // being pinned.

    private fun restart() {
        stopAll()
        slots.clear()
        _state.value = State()
        append(PageRequest(pageSize))
        publish()
    }

    private fun append(request: PageRequest) {
        slots.add(Slot(nextSlotId++, request))
        subscribe(slots.last())
    }

    /**
     * Swaps one slot for new ones. [keeping] shows the old result until the replacement delivers.
     */
    private fun replace(index: Int, requests: List<PageRequest>, keeping: Page<T>?) {
        slots[index].job?.cancel()
        val replacements = requests.map { Slot<T>(nextSlotId++, it) }
        if (replacements.size == 1) replacements[0].result = keeping
        slots.removeAt(index)
        slots.addAll(index, replacements)
        replacements.forEach(::subscribe)
    }

    private fun subscribe(slot: Slot<T>) {
        val client = client ?: return
        val scope = scope ?: return
        // Only the unpinned first page is cached: it's what a fresh launch shows.
        val cached = slot.request.cursor == null && slot.request.endCursor == null
        slot.job = scope.launch {
            try {
                client.observe(makeQuery(slot.request), cached).collect { receive(it, slot.id) }
            } catch (error: NeramError) {
                fail(error, slot.id)
            }
        }
    }

    private fun receive(page: Page<T>, slotId: Int) {
        val index = slots.indexOfFirst { it.id == slotId }
        if (index < 0) return
        val request = slots[index].request
        val split = page.splitCursor
        if (split != null && page.pageStatus != null) {
            val end = request.endCursor ?: page.continueCursor
            replace(
                index,
                listOf(
                    PageRequest(pageSize, request.cursor, split),
                    PageRequest(pageSize, split, end),
                ),
                keeping = null,
            )
            publish()
            return
        }
        slots[index].result = page
        _state.value = _state.value.copy(error = null)
        publish()
    }

    private fun fail(error: NeramError, slotId: Int) {
        val index = slots.indexOfFirst { it.id == slotId }
        if (index < 0) return
        if (index == 0) {
            _state.value = _state.value.copy(error = error)
            publish()
        } else {
            restart()
        }
    }

    private fun stopAll() {
        slots.forEach { it.job?.cancel() }
    }

    private fun publish() {
        val status =
            when {
                slots.firstOrNull()?.result == null -> Status.LoadingFirstPage
                slots.any { it.result == null } -> Status.LoadingMore
                slots.lastOrNull()?.result?.isDone == true -> Status.Exhausted
                else -> Status.CanLoadMore
            }
        _state.value =
            _state.value.copy(items = slots.flatMap { it.result?.page.orEmpty() }, status = status)
        if (loadsAllPages && status == Status.CanLoadMore) loadMore()
    }
}
