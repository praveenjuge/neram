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
 * between pages (no duplicates or gaps). A page the server asks to split keeps showing its rows
 * while two pinned halves load, then the halves replace it together. If a later page fails (for
 * example a cursor became invalid), the list restarts from the first page.
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
        /** Showing saved data: more pages load once the workspace is open online. */
        SavedOnly,
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
        /** Pinned halves loading to replace this slot after the server asked to split it. */
        var halves: List<Slot<T>>? = null

        fun cancel() {
            job?.cancel()
            halves?.forEach { it.job?.cancel() }
        }
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
                PageRequest(pageSize, last.request.cursor, result.continueCursor),
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
        slots.add(newSlot(request))
    }

    /** Swaps one slot for a pinned one that shows [keeping] until it delivers. */
    private fun replace(index: Int, request: PageRequest, keeping: Page<T>?) {
        slots[index].cancel()
        slots[index] = newSlot(request).also { it.result = keeping }
    }

    private fun newSlot(request: PageRequest): Slot<T> {
        val slot = Slot<T>(nextSlotId++, request)
        subscribe(slot)
        return slot
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
        if (index >= 0) {
            val slot = slots[index]
            slot.result = page
            val split = page.splitCursor
            if (split != null && page.pageStatus != null && slot.halves == null) {
                val end = slot.request.endCursor ?: page.continueCursor
                slot.halves =
                    listOf(
                        newSlot(PageRequest(pageSize, slot.request.cursor, split)),
                        newSlot(PageRequest(pageSize, split, end)),
                    )
            }
            _state.value = _state.value.copy(error = null)
            publish()
            return
        }
        // A half of a split: swap both in once both have loaded.
        val parentIndex = slots.indexOfFirst { parent ->
            parent.halves?.any { it.id == slotId } == true
        }
        if (parentIndex < 0) return
        val parent = slots[parentIndex]
        val halves = parent.halves ?: return
        halves.first { it.id == slotId }.result = page
        if (halves.all { it.result != null }) {
            parent.job?.cancel()
            slots.removeAt(parentIndex)
            slots.addAll(parentIndex, halves)
            publish()
        }
    }

    private fun fail(error: NeramError, slotId: Int) {
        val index = slots.indexOfFirst { it.id == slotId }
        if (index == 0) {
            _state.value = _state.value.copy(error = error)
            publish()
        } else if (
            index > 0 || slots.any { parent -> parent.halves?.any { it.id == slotId } == true }
        ) {
            restart()
        }
    }

    private fun stopAll() {
        slots.forEach { it.cancel() }
    }

    private fun publish() {
        val status =
            when {
                slots.firstOrNull()?.result == null -> Status.LoadingFirstPage
                slots.any { it.result == null } -> Status.LoadingMore
                slots.lastOrNull()?.result?.isDone == true -> Status.Exhausted
                client?.isLive == false -> Status.SavedOnly
                else -> Status.CanLoadMore
            }
        _state.value =
            _state.value.copy(items = slots.flatMap { it.result?.page.orEmpty() }, status = status)
        if (loadsAllPages && status == Status.CanLoadMore) loadMore()
    }
}
