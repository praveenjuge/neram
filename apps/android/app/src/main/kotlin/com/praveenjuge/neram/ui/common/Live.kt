package com.praveenjuge.neram.ui.common

import com.praveenjuge.neram.data.NeramError
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn

/** A live query's state for a screen: still loading, failed, or showing a value. */
sealed interface Live<out T> {
    data object Loading : Live<Nothing>

    data class Failed(val error: NeramError) : Live<Nothing>

    data class Loaded<T>(val value: T) : Live<T>
}

fun <T> Flow<T>.asLive(): Flow<Live<T>> =
    map<T, Live<T>> { Live.Loaded(it) }
        .onStart { emit(Live.Loading) }
        .catch { emit(Live.Failed(NeramError.from(it))) }

/** A screen's live query, which [retry] subscribes to again after a failure. */
@OptIn(ExperimentalCoroutinesApi::class)
class LiveQuery<T>(scope: CoroutineScope, source: () -> Flow<T>) {
    private val attempt = MutableStateFlow(0)

    val state: StateFlow<Live<T>> =
        attempt
            .flatMapLatest { source().asLive() }
            .stateIn(scope, SharingStarted.WhileSubscribed(5_000), Live.Loading)

    fun retry() {
        attempt.value += 1
    }
}
