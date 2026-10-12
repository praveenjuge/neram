package com.praveenjuge.neram.ui.tasks

import com.praveenjuge.neram.data.NeramError
import com.praveenjuge.neram.data.ServerError
import com.praveenjuge.neram.ui.common.ActionState
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EditableFieldTest {
    private val sent = mutableListOf<Pair<String, String>>()
    private var failure: NeramError? = null
    private val action = ActionState()
    private val field =
        EditableField(action, allowsEmpty = false, normalize = { it }) { value, expected ->
            sent += value to expected
            failure?.let { throw it }
        }

    @Test
    fun savesTheTrimmedEditAgainstTheValueItStartedFrom() = runTest {
        field.change("  New title ", live = "Old")
        assertEquals("  New title ", field.text(live = "Old"))
        field.commit(this)
        testScheduler.advanceUntilIdle()
        assertEquals(listOf("New title" to "Old"), sent)
        // Until the live task catches up, the field shows what was saved.
        assertEquals("New title", field.text(live = "Old"))
        field.settle(live = "New title")
        assertEquals("Newer", field.text(live = "Newer"))
    }

    @Test
    fun unchangedOrEmptyTitlesAreNotSaved() = runTest {
        field.change("Same", live = "Same")
        field.commit(this)
        field.change("   ", live = "Same")
        field.commit(this)
        testScheduler.advanceUntilIdle()
        assertTrue(sent.isEmpty())
        assertEquals("Same", field.text(live = "Same"))
    }

    @Test
    fun aNewerEditElsewhereBecomesAConflict() = runTest {
        failure =
            NeramError.Server(
                ServerError("EDIT_CONFLICT", "Changed.", field = "title", latestValue = "Theirs")
            )
        field.change("Mine", live = "Old")
        field.commit(this)
        testScheduler.advanceUntilIdle()
        assertEquals(EditableField.Conflict("Mine", "Theirs"), field.conflict)
        assertNull(action.error)
        // The field shows the latest server value while the conflict is open.
        assertEquals("Theirs", field.text(live = "Theirs"))

        failure = null
        field.keepMine(this)
        testScheduler.advanceUntilIdle()
        assertEquals("Mine" to "Theirs", sent.last())
        assertNull(field.conflict)
        assertEquals("Mine", field.text(live = "Theirs"))
    }

    @Test
    fun otherFailuresKeepTheDraftAndRetryOnTheNextCommit() = runTest {
        failure = NeramError.Unexpected("offline")
        field.change("Mine", live = "Old")
        field.commit(this)
        testScheduler.advanceUntilIdle()
        assertEquals(failure, action.error)
        assertEquals("Mine", field.text(live = "Old"))

        failure = null
        field.commit(this)
        testScheduler.advanceUntilIdle()
        assertEquals(listOf("Mine" to "Old", "Mine" to "Old"), sent)
    }

    @Test
    fun aQuickSecondEditExpectsTheFirstSave() = runTest {
        val gate = CompletableDeferred<Unit>()
        val slow =
            EditableField(action, allowsEmpty = true, normalize = { it }) { value, expected ->
                sent += value to expected
                if (sent.size == 1) gate.await()
            }
        slow.change("One", live = "")
        slow.commit(this)
        testScheduler.advanceUntilIdle()
        slow.change("Two", live = "")
        slow.commit(this)
        gate.complete(Unit)
        testScheduler.advanceUntilIdle()
        assertEquals(listOf("One" to "", "Two" to "One"), sent)
    }

    @Test
    fun useLatestDropsAnEditTypedDuringTheConflictingSave() = runTest {
        val gate = CompletableDeferred<Unit>()
        val racing =
            EditableField(action, allowsEmpty = true, normalize = { it }) { value, expected ->
                sent += value to expected
                gate.await()
                throw NeramError.Server(
                    ServerError("EDIT_CONFLICT", "Changed.", latestValue = "Theirs")
                )
            }
        racing.change("Mine", live = "Old")
        racing.commit(this)
        testScheduler.advanceUntilIdle()
        // Keep typing while the save is still in flight, then it conflicts.
        racing.change("Mine, more", live = "Old")
        gate.complete(Unit)
        testScheduler.advanceUntilIdle()
        assertEquals("Mine, more", racing.text(live = "Theirs"))

        racing.useLatest()
        assertNull(racing.conflict)
        assertEquals("Theirs", racing.text(live = "Theirs"))
        // Leaving the field afterwards sends nothing more.
        racing.commit(this)
        testScheduler.advanceUntilIdle()
        assertEquals(listOf("Mine" to "Old"), sent)
    }
}
