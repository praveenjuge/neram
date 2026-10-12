package com.praveenjuge.neram.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Neram's lime accent on neutral surfaces, like the web and Apple apps. Material's baseline
// surfaces are tinted purple, so every surface role is set here.
private val LightColors =
    lightColorScheme(
        primary = Color(0xFF4F8A00),
        onPrimary = Color.White,
        primaryContainer = Color(0xFFD9F5B0),
        onPrimaryContainer = Color(0xFF1D3300),
        secondary = Color(0xFF5A6150),
        onSecondary = Color.White,
        secondaryContainer = Color(0xFFE2F0CF),
        onSecondaryContainer = Color(0xFF1D3300),
        background = Color.White,
        onBackground = Color(0xFF1A1C18),
        surface = Color.White,
        onSurface = Color(0xFF1A1C18),
        surfaceVariant = Color(0xFFE6E7E2),
        onSurfaceVariant = Color(0xFF575A52),
        surfaceContainerLowest = Color.White,
        surfaceContainerLow = Color(0xFFF7F7F4),
        surfaceContainer = Color(0xFFF2F2EF),
        surfaceContainerHigh = Color(0xFFECEDE9),
        surfaceContainerHighest = Color(0xFFE6E7E3),
        outline = Color(0xFF787B72),
        outlineVariant = Color(0xFFC8CAC2),
    )

private val DarkColors =
    darkColorScheme(
        primary = Color(0xFF7CCF00),
        onPrimary = Color(0xFF173000),
        primaryContainer = Color(0xFF2E4D00),
        onPrimaryContainer = Color(0xFFD9F5B0),
        secondary = Color(0xFFC1C9B4),
        onSecondary = Color(0xFF2B3323),
        secondaryContainer = Color(0xFF34401F),
        onSecondaryContainer = Color(0xFFE2F0CF),
        background = Color(0xFF111210),
        onBackground = Color(0xFFE3E3DE),
        surface = Color(0xFF111210),
        onSurface = Color(0xFFE3E3DE),
        surfaceVariant = Color(0xFF44473F),
        onSurfaceVariant = Color(0xFFC5C7BE),
        surfaceContainerLowest = Color(0xFF0C0D0B),
        surfaceContainerLow = Color(0xFF191A17),
        surfaceContainer = Color(0xFF1D1E1B),
        surfaceContainerHigh = Color(0xFF282926),
        surfaceContainerHighest = Color(0xFF333430),
        outline = Color(0xFF8F9289),
        outlineVariant = Color(0xFF44473F),
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
