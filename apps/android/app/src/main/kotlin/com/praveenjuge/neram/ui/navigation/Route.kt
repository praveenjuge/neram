package com.praveenjuge.neram.ui.navigation

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

/** Every screen a tab's back stack can hold. Saved with the back stack, so keep them small. */
@Serializable
sealed interface Route : NavKey {
    @Serializable data object Home : Route

    @Serializable data object MyTasks : Route

    @Serializable data object Focus : Route

    @Serializable data object Activity : Route

    @Serializable data class Project(val id: String) : Route

    @Serializable data object Archived : Route

    @Serializable data class Task(val id: String) : Route
}
