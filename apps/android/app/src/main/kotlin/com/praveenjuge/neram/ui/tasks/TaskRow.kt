package com.praveenjuge.neram.ui.tasks

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material.icons.outlined.Timelapse
import androidx.compose.material3.ButtonGroupDefaults
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.ToggleButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.praveenjuge.neram.data.DueDate
import com.praveenjuge.neram.data.model.TaskItem
import com.praveenjuge.neram.data.model.TaskStatus
import com.praveenjuge.neram.ui.common.ProjectStyle
import com.praveenjuge.neram.ui.common.UserAvatar

val TaskStatus.icon: ImageVector
    get() =
        when (this) {
            TaskStatus.Todo -> Icons.Outlined.RadioButtonUnchecked
            TaskStatus.InProgress -> Icons.Outlined.Timelapse
            TaskStatus.Done -> Icons.Filled.CheckCircle
        }

/**
 * One task line: status, title, due date, project (on cross-project lists), subtask and comment
 * counts, and the assignee. Mirrors the web's TaskItem.
 */
@Composable
fun TaskRow(
    task: TaskItem,
    modifier: Modifier = Modifier,
    showsProject: Boolean = false,
    leading: @Composable () -> Unit = { StatusIcon(task.status) },
) {
    val done = task.status == TaskStatus.Done
    ListItem(
        modifier = modifier,
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        leadingContent = leading,
        supportingContent =
            if (hasMeta(task, showsProject)) ({ TaskMeta(task, showsProject) }) else null,
        trailingContent =
            task.assigneeName?.let { name ->
                {
                    UserAvatar(
                        name,
                        Modifier.clearAndSetSemantics { contentDescription = "Assigned to $name" },
                    )
                }
            },
    ) {
        Text(
            task.title,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis,
            textDecoration = if (done) TextDecoration.LineThrough else null,
        )
    }
}

/** A status as an icon, highlighted when done. */
@Composable
fun StatusIcon(status: TaskStatus, description: String = status.label) {
    Icon(
        status.icon,
        contentDescription = description,
        tint =
            if (status == TaskStatus.Done) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

private fun hasMeta(task: TaskItem, showsProject: Boolean) =
    task.dueDate != null ||
        (showsProject && task.projectName != null) ||
        task.totalSubtasks > 0 ||
        task.activeCommentCount > 0

@Composable
private fun TaskMeta(task: TaskItem, showsProject: Boolean) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        task.dueDate?.let { MetaLabel(Icons.Outlined.CalendarToday, DueDate.display(it)) }
        if (showsProject && task.projectName != null) {
            val style = ProjectStyle.icon(task.projectIcon)
            MetaLabel(style.vector, task.projectName, ProjectStyle.color(task.projectColor).color)
        }
        if (task.totalSubtasks > 0) {
            MetaLabel(
                Icons.Outlined.Checklist,
                "${task.completedSubtasks.toInt()}/${task.totalSubtasks.toInt()}",
            )
        }
        if (task.activeCommentCount > 0) {
            MetaLabel(Icons.AutoMirrored.Outlined.Chat, "${task.activeCommentCount.toInt()}")
        }
    }
}

@Composable
private fun RowScope.MetaLabel(icon: ImageVector, text: String, tint: Color = Color.Unspecified) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(14.dp))
        Text(
            text,
            style = MaterialTheme.typography.labelMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * Connected toggle buttons for picking a status, one per entry in [statuses]. [label] can add
 * counts; [itemModifier] lets a board make each button a drop target.
 */
@Composable
fun StatusPicker(
    selected: TaskStatus,
    onSelect: (TaskStatus) -> Unit,
    modifier: Modifier = Modifier,
    statuses: List<TaskStatus> = TaskStatus.entries,
    enabled: Boolean = true,
    label: (TaskStatus) -> String = { it.label },
    itemModifier: @Composable (TaskStatus) -> Modifier = { Modifier },
) = ChoiceButtons(statuses, selected, onSelect, modifier, enabled, label, itemModifier)

/** Connected toggle buttons for a single choice, the Expressive take on a segmented control. */
@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun <T> ChoiceButtons(
    options: List<T>,
    selected: T,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    label: (T) -> String,
    itemModifier: @Composable (T) -> Modifier = { Modifier },
) {
    Row(
        modifier,
        horizontalArrangement = Arrangement.spacedBy(ButtonGroupDefaults.ConnectedSpaceBetween),
    ) {
        options.forEachIndexed { index, option ->
            ToggleButton(
                checked = option == selected,
                onCheckedChange = { onSelect(option) },
                enabled = enabled,
                modifier = itemModifier(option).weight(1f).semantics { role = Role.RadioButton },
                shapes =
                    when (index) {
                        0 -> ButtonGroupDefaults.connectedLeadingButtonShapes()
                        options.lastIndex -> ButtonGroupDefaults.connectedTrailingButtonShapes()
                        else -> ButtonGroupDefaults.connectedMiddleButtonShapes()
                    },
            ) {
                Text(label(option), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}
