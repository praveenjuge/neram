package com.praveenjuge.neram.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.List
import androidx.compose.material.icons.outlined.CenterFocusStrong
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import com.praveenjuge.neram.ui.activity.ActivityScreen
import com.praveenjuge.neram.ui.common.LocalIsConnected
import com.praveenjuge.neram.ui.focus.FocusScreen
import com.praveenjuge.neram.ui.home.HomeScreen
import com.praveenjuge.neram.ui.navigation.Route
import com.praveenjuge.neram.ui.projects.ArchivedProjectsScreen
import com.praveenjuge.neram.ui.projects.ProjectScreen
import com.praveenjuge.neram.ui.tasks.MyTasksScreen

private enum class Section(val label: String, val icon: ImageVector, val root: Route) {
    Home("Home", Icons.Outlined.Home, Route.Home),
    Tasks("My Tasks", Icons.AutoMirrored.Outlined.List, Route.MyTasks),
    Focus("Focus", Icons.Outlined.CenterFocusStrong, Route.Focus),
    Activity("Activity", Icons.Outlined.History, Route.Activity),
}

/**
 * Bottom bar on phones, rail on tablets and unfolded foldables, drawer on wide screens. Each tab
 * keeps its own back stack.
 */
@Composable
fun MainScaffold(isConnected: Boolean) {
    var selected by rememberSaveable { mutableStateOf(Section.Home) }
    val stacks = Section.entries.associateWith { rememberNavBackStack(it.root) }
    val stack = stacks.getValue(selected)

    NavigationSuiteScaffold(
        navigationSuiteItems = {
            Section.entries.forEach { section ->
                item(
                    selected = selected == section,
                    onClick = {
                        // Tapping the current tab again returns to its first screen.
                        if (section == selected) stacks.getValue(section).popToRoot()
                        selected = section
                    },
                    icon = { Icon(section.icon, contentDescription = null) },
                    label = { Text(section.label) },
                )
            }
        }
    ) {
        Column {
            if (!isConnected) {
                Text(
                    "Offline. Showing saved data; changes are paused.",
                    style = MaterialTheme.typography.labelLarge,
                    textAlign = TextAlign.Center,
                    modifier =
                        Modifier.fillMaxWidth()
                            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                            .statusBarsPadding()
                            .padding(vertical = 6.dp),
                )
            }
            // The banner already sits below the status bar, so the screen mustn't pad for it again.
            Box(
                if (isConnected) Modifier else Modifier.consumeWindowInsets(WindowInsets.statusBars)
            ) {
                CompositionLocalProvider(LocalIsConnected provides isConnected) {
                    TabContent(stack)
                }
            }
        }
    }
}

/** One tab's back stack. Pushed screens get their own view models, cleared when popped. */
@Composable
private fun TabContent(stack: NavBackStack<NavKey>) {
    val back: () -> Unit = { if (stack.size > 1) stack.removeLastOrNull() }
    NavDisplay(
        backStack = stack,
        onBack = back,
        entryDecorators =
            listOf(
                rememberSaveableStateHolderNavEntryDecorator(),
                rememberViewModelStoreNavEntryDecorator(),
            ),
        entryProvider =
            entryProvider {
                entry<Route.Home> {
                    HomeScreen(
                        onOpenProject = { stack.add(Route.Project(it)) },
                        onOpenArchived = { stack.add(Route.Archived) },
                    )
                }
                entry<Route.MyTasks> { MyTasksScreen() }
                entry<Route.Focus> { FocusScreen() }
                entry<Route.Activity> { ActivityScreen() }
                entry<Route.Project> { route -> ProjectScreen(route.id, onBack = back) }
                entry<Route.Archived> { ArchivedProjectsScreen(onBack = back) }
            },
    )
}

private fun NavBackStack<NavKey>.popToRoot() {
    while (size > 1) removeLastOrNull()
}
