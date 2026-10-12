package com.praveenjuge.neram.ui.common

import androidx.activity.compose.LocalActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.lifecycle.HasDefaultViewModelProviderFactory
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner

/**
 * The workspace's own view model store. Tab roots keep their view models here, so switching tabs
 * doesn't reload them; pushed screens use their back stack entry's store instead.
 */
val LocalWorkspaceViewModelStoreOwner =
    staticCompositionLocalOf<ViewModelStoreOwner> { error("Outside a WorkspaceScope") }

/**
 * Gives the screens inside it their own view models, cleared when [key] changes or the scope leaves
 * the screen. Without it, view models live as long as the activity, so a workspace's live queries
 * would keep running after switching to another one.
 */
@Composable
fun WorkspaceScope(key: Any, content: @Composable () -> Unit) {
    // The activity's factory is Hilt's, so `hiltViewModel()` works inside this scope.
    val activity = LocalActivity.current as HasDefaultViewModelProviderFactory
    val owner =
        remember(key) {
            object : ViewModelStoreOwner, HasDefaultViewModelProviderFactory by activity {
                override val viewModelStore = ViewModelStore()
            }
        }
    DisposableEffect(owner) { onDispose { owner.viewModelStore.clear() } }
    CompositionLocalProvider(
        LocalViewModelStoreOwner provides owner,
        LocalWorkspaceViewModelStoreOwner provides owner,
        content = content,
    )
}
