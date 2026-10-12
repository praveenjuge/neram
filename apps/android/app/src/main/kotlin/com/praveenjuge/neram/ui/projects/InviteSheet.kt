package com.praveenjuge.neram.ui.projects

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SheetValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.praveenjuge.neram.data.Calls
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.prefixUtf16
import com.praveenjuge.neram.ui.common.ActionErrorDialog
import com.praveenjuge.neram.ui.common.ActionState
import kotlinx.coroutines.launch

/** Invite someone to the workspace through Neram's server-checked invite. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InviteSheet(client: NeramClient, isConnected: Boolean, onDismiss: () -> Unit) {
    var email by rememberSaveable { mutableStateOf("") }
    var sentTo by rememberSaveable { mutableStateOf<String?>(null) }
    val action = remember { ActionState() }
    val scope = rememberCoroutineScope()
    val trimmed = email.trim()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState =
            rememberBottomSheetState(
                SheetValue.Hidden,
                setOf(SheetValue.Hidden, SheetValue.Expanded),
            ),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 20.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onDismiss) { Text("Done") }
                Text(
                    "Share Projects",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                )
                Button(
                    enabled = trimmed.isNotEmpty() && !action.running && isConnected,
                    onClick = {
                        scope.launch {
                            if (action.run { client.run(Calls.invite(trimmed)) }) {
                                sentTo = trimmed
                                email = ""
                            }
                        }
                    },
                ) {
                    Text(if (action.running) "Sending…" else "Send Invite")
                }
            }
            OutlinedTextField(
                value = email,
                onValueChange = { email = it.trim().prefixUtf16(254) },
                label = { Text("Email") },
                placeholder = { Text("name@example.com") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                "Invite someone to this workspace. They can view and work on every project.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            sentTo?.let {
                Text("Invitation sent to $it.", color = MaterialTheme.colorScheme.primary)
            }
        }
    }
    ActionErrorDialog(action, title = "Couldn't send the invitation")
}
