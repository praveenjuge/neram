package com.praveenjuge.neram.ui.tasks

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenu
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.praveenjuge.neram.data.DueDate
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.model.Member
import com.praveenjuge.neram.data.model.ProjectName
import com.praveenjuge.neram.ui.common.ProjectBadge
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/** A read-only field that opens a menu of [options] (key to label). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MenuField(
    label: String,
    value: String,
    options: List<Pair<String, String>>,
    onSelect: (String) -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    leading: (@Composable (String) -> Unit)? = null,
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it && enabled },
        modifier = modifier,
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            enabled = enabled,
            label = { Text(label) },
            singleLine = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier =
                Modifier.fillMaxWidth()
                    .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable, enabled),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (key, text) ->
                DropdownMenuItem(
                    text = { Text(text) },
                    leadingIcon = leading?.let { { it(key) } },
                    onClick = {
                        expanded = false
                        onSelect(key)
                    },
                )
            }
        }
    }
}

@Composable
fun ProjectPicker(
    selected: DocumentId?,
    projects: List<ProjectName>,
    onSelect: (DocumentId) -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier,
) {
    MenuField(
        label = "Project",
        value = projects.firstOrNull { it.id == selected }?.name ?: "",
        options = projects.map { it.id to it.name },
        onSelect = onSelect,
        enabled = enabled,
        modifier = modifier,
        leading = { id ->
            val project = projects.firstOrNull { it.id == id }
            ProjectBadge(project?.icon, project?.color, size = 24.dp)
        },
    )
}

/** "Unassigned" plus every member, marking the current user "(you)". An empty key unassigns. */
@Composable
fun AssigneePicker(
    selected: String,
    members: List<Member>,
    currentUserId: String?,
    onSelect: (String) -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier,
) {
    val options =
        listOf("" to "Unassigned") +
            members.map {
                it.userId to
                    if (it.userId == currentUserId) "${it.displayName} (you)" else it.displayName
            }
    MenuField(
        label = "Assignee",
        value = options.firstOrNull { it.first == selected }?.second ?: "Unassigned",
        options = options,
        onSelect = onSelect,
        enabled = enabled,
        modifier = modifier,
    )
}

/** A due date that can be added, changed, or removed. `null` means no due date. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DueDateField(
    date: LocalDate?,
    onChange: (LocalDate?) -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier,
) {
    var picking by remember { mutableStateOf(false) }
    // A read-only field doesn't report clicks, so watch its presses to open the picker.
    val presses = remember { MutableInteractionSource() }
    LaunchedEffect(presses) {
        presses.interactions.collect { if (it is PressInteraction.Release) picking = true }
    }
    OutlinedTextField(
        value = date?.let { DueDate.display(DueDate.format(it)) } ?: "",
        onValueChange = {},
        readOnly = true,
        enabled = enabled,
        label = { Text("Due date") },
        placeholder = { Text("No due date") },
        singleLine = true,
        interactionSource = presses,
        leadingIcon = { Icon(Icons.Outlined.CalendarToday, contentDescription = null) },
        trailingIcon =
            if (date != null) {
                {
                    IconButton(onClick = { onChange(null) }, enabled = enabled) {
                        Icon(Icons.Outlined.Close, contentDescription = "Remove Due Date")
                    }
                }
            } else null,
        modifier =
            modifier.fillMaxWidth().semantics {
                onClick("Choose due date") {
                    picking = true
                    true
                }
            },
    )
    if (picking) {
        // DatePicker works in UTC milliseconds; calendar days convert without a time zone.
        val state =
            rememberDatePickerState(
                initialSelectedDateMillis =
                    (date ?: LocalDate.now())
                        .atStartOfDay(ZoneOffset.UTC)
                        .toInstant()
                        .toEpochMilli()
            )
        DatePickerDialog(
            onDismissRequest = { picking = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        picking = false
                        state.selectedDateMillis?.let {
                            onChange(
                                Instant.ofEpochMilli(it).atOffset(ZoneOffset.UTC).toLocalDate()
                            )
                        }
                    }
                ) {
                    Text("OK")
                }
            },
            dismissButton = { TextButton(onClick = { picking = false }) { Text("Cancel") } },
        ) {
            DatePicker(state)
        }
    }
}
