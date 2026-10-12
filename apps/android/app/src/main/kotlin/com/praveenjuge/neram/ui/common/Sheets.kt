package com.praveenjuge.neram.ui.common

import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SheetState
import androidx.compose.material3.SheetValue
import androidx.compose.material3.rememberBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState

/**
 * A full-height sheet that can't be swiped, tapped, or backed away while [holding] is true, so a
 * request it started finishes in view.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun rememberHoldingSheetState(holding: () -> Boolean): SheetState {
    val isHolding by rememberUpdatedState(holding)
    return rememberBottomSheetState(
        SheetValue.Hidden,
        setOf(SheetValue.Hidden, SheetValue.Expanded),
        confirmValueChange = { it != SheetValue.Hidden || !isHolding() },
    )
}
