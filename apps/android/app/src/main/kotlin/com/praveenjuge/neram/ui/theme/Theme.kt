package com.praveenjuge.neram.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.expressiveLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Neram's lime, the same accent as the web and Apple apps.
private val LimeLight = Color(0xFF63A402)
private val LimeDark = Color(0xFF7CCF00)

private val LightColors =
    expressiveLightColorScheme()
        .copy(
            primary = LimeLight,
            onPrimary = Color.White,
            primaryContainer = Color(0xFFD9F5B0),
            onPrimaryContainer = Color(0xFF1D3300),
        )

private val DarkColors =
    darkColorScheme(
        primary = LimeDark,
        onPrimary = Color(0xFF173000),
        primaryContainer = Color(0xFF2E4D00),
        onPrimaryContainer = Color(0xFFD9F5B0),
    )

/** Material 3 Expressive with Neram's lime; follows the system light or dark setting. */
@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun NeramTheme(content: @Composable () -> Unit) {
    MaterialExpressiveTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
