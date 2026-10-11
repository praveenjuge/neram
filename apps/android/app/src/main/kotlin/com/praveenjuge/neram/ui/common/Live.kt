package com.praveenjuge.neram.ui.common

import com.praveenjuge.neram.data.NeramError
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart

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
