package com.praveenjuge.neram.ui.common

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.praveenjuge.neram.data.NeramError

/** One user action at a time (save, archive, send): whether it's running and how it failed. */
class ActionState {
    var running by mutableStateOf(false)
        private set

    var error by mutableStateOf<NeramError?>(null)

    /** Runs [work], keeping its failure for [ActionErrorDialog]. Returns whether it succeeded. */
    suspend fun run(work: suspend () -> Unit): Boolean {
        running = true
        return try {
            work()
            true
        } catch (failure: NeramError) {
            error = failure
            false
        } finally {
            running = false
        }
    }
}

/** Shows the last failed action, if any, until dismissed. */
@Composable
fun ActionErrorDialog(state: ActionState, title: String = "Something went wrong") {
    val error = state.error ?: return
    AlertDialog(
        onDismissRequest = { state.error = null },
        title = { Text(title) },
        text = { Text(error.message ?: "Try again.") },
        confirmButton = { TextButton(onClick = { state.error = null }) { Text("OK") } },
    )
}

/** A yes-or-cancel question before a destructive action. */
@Composable
fun ConfirmDialog(
    title: String,
    message: String,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = {
            TextButton(
                onClick = {
                    onDismiss()
                    onConfirm()
                }
            ) {
                Text(confirmLabel)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
