package com.praveenjuge.neram.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.praveenjuge.neram.ui.activity.ActivityScreen
import com.praveenjuge.neram.ui.focus.FocusScreen
import com.praveenjuge.neram.ui.home.HomeScreen
import com.praveenjuge.neram.ui.tasks.MyTasksScreen

private enum class Section(val label: String, val icon: ImageVector) {
    Home("Home", Icons.Outlined.Home),
    Tasks("My Tasks", Icons.AutoMirrored.Outlined.List),
    Focus("Focus", Icons.Outlined.CenterFocusStrong),
    Activity("Activity", Icons.Outlined.History),
}

/** Bottom bar on phones, rail on tablets and unfolded foldables, drawer on wide screens. */
@Composable
fun MainScaffold(workspaceId: String, isConnected: Boolean) {
    var selected by rememberSaveable { mutableSection(Section.Home) }
    NavigationSuiteScaffold(
        navigationSuiteItems = {
            Section.entries.forEach { section ->
                item(
                    selected = selected == section,
                    onClick = { selected = section },
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
                            .padding(vertical = 6.dp),
                )
            }
            when (selected) {
                Section.Home -> HomeScreen(workspaceId)
                Section.Tasks -> MyTasksScreen(workspaceId)
                Section.Focus -> FocusScreen(workspaceId)
                Section.Activity -> ActivityScreen(workspaceId)
            }
        }
    }
}

private fun mutableSection(section: Section) = androidx.compose.runtime.mutableStateOf(section)
