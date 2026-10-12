package com.praveenjuge.neram.ui.tasks

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.praveenjuge.neram.data.NeramError
import com.praveenjuge.neram.ui.common.ActionState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * A task text field that saves when editing finishes, like the web's task dialog. Each save sends
 * the value the edit started from, so a newer edit by someone else comes back as a [conflict] to
 * resolve instead of being overwritten. Other failures keep the typed text and land in [action];
 * finishing the edit again retries.
 *
 * [save] receives the new value and the server value it expects.
 */
class EditableField(
    private val action: ActionState,
    private val allowsEmpty: Boolean,
    private val normalize: (String) -> String,
    private val save: suspend (value: String, expected: String) -> Unit,
) {
    /** Someone else changed the field: [mine] is our value, [latest] theirs. */
    data class Conflict(val mine: String, val latest: String?)

    private var draft by mutableStateOf("")
    /** The server value the current edit expects; set while editing or saving. */
    private var base by mutableStateOf<String?>(null)
    private var saving by mutableIntStateOf(0)
    /** The last value saved here, used until the live task shows it. */
    private var saved by mutableStateOf<String?>(null)

    var conflict by mutableStateOf<Conflict?>(null)
        private set

    /** What the field shows, given the [live] server value. */
    fun text(live: String): String = if (base == null) known(live) else draft

    fun change(value: String, live: String) {
        if (base == null) base = known(live)
        draft = normalize(value)
    }

    /**
     * Saves a finished edit. The field keeps showing the draft until the save settles, and a
     * follow-up edit expects this save's value.
     */
    fun commit(scope: CoroutineScope) {
        val expected = base ?: return
        val value = draft.trim()
        val invalid = !allowsEmpty && value.isEmpty()
        if (invalid) draft = expected
        if (value == expected || invalid) {
            if (saving == 0) base = null
            return
        }
        base = value
        scope.launch { send(value, expected) }
    }

    /** Forgets the saved value once the live task shows it, or changes with nothing in flight. */
    fun settle(live: String) {
        val value = saved ?: return
        if (live == value || saving == 0) saved = null
    }

    /** Drops our edit, including anything typed since, and shows the server's value. */
    fun useLatest() {
        conflict = null
        base = null
        draft = ""
        saved = null
    }

    fun keepMine(scope: CoroutineScope) {
        val conflict = conflict ?: return
        scope.launch { send(conflict.mine, conflict.latest ?: "") }
    }

    private fun known(live: String) = saved ?: live

    private suspend fun send(value: String, expected: String) {
        saving += 1
        var keepsDraft = false
        try {
            // Finishes even if the screen closes meanwhile, so leaving never drops an edit.
            withContext(NonCancellable) { save(value, expected) }
            saved = value
            conflict = null
        } catch (error: NeramError) {
            val payload = (error as? NeramError.Server)?.payload
            if (payload?.code == "EDIT_CONFLICT") {
                conflict = Conflict(value, payload.latestValue)
            } else {
                // Keep the typed text; finishing the edit again retries against the value the
                // server still has.
                if (base == value) base = expected
                keepsDraft = true
                action.error = error
            }
        } finally {
            saving -= 1
        }
        if (!keepsDraft && saving == 0 && base == value && draft.trim() == value) base = null
    }
}
