package com.praveenjuge.neram.ui.common

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Keeps the native icon and color sets identical to the web's, which own the keys stored in Convex.
 */
class ProjectStyleTest {
    private val webLib = File("../../../apps/web/src/lib")

    /** Keys declared inside `export const <name> = { ... }` in a web lib file. */
    private fun webKeys(file: String, name: String, pattern: String): List<String> {
        val source = File(webLib, file).readText()
        val start = source.indexOf("$name = {")
        assertTrue("$name not found in $file", start >= 0)
        val bodyStart = start + "$name = {".length
        val end = source.indexOf("\n}", bodyStart)
        assertTrue("end of $name not found in $file", end >= 0)
        return Regex(pattern, RegexOption.MULTILINE)
            .findAll(source.substring(bodyStart, end))
            .map { it.groupValues[1] }
            .toList()
    }

    @Test
    fun iconKeysMatchTheWebInOrder() {
        val web = webKeys("project-icons.ts", "PROJECT_ICONS", """^\s+"?([a-z0-9-]+)"?:\s*[A-Z]""")
        assertEquals(142, web.size)
        assertEquals(web, ProjectStyle.icons.map { it.key })
    }

    @Test
    fun colorKeysMatchTheWebInOrder() {
        val web = webKeys("project-colors.ts", "PROJECT_COLORS", """^  ([a-z]+): \{""")
        assertEquals(web, ProjectStyle.colors.map { it.key })
    }

    @Test
    fun colorsAreTailwind500() {
        val expected =
            mapOf(
                "slate" to 0x64748B,
                "gray" to 0x6B7280,
                "zinc" to 0x71717A,
                "neutral" to 0x737373,
                "stone" to 0x78716C,
                "red" to 0xEF4444,
                "rose" to 0xF43F5E,
                "orange" to 0xF97316,
                "amber" to 0xF59E0B,
                "yellow" to 0xEAB308,
                "lime" to 0x84CC16,
                "green" to 0x22C55E,
                "emerald" to 0x10B981,
                "teal" to 0x14B8A6,
                "cyan" to 0x06B6D4,
                "sky" to 0x0EA5E9,
                "blue" to 0x3B82F6,
                "indigo" to 0x6366F1,
                "violet" to 0x8B5CF6,
                "purple" to 0xA855F7,
                "fuchsia" to 0xD946EF,
                "pink" to 0xEC4899,
            )
        assertEquals(
            expected.mapValues { 0xFF000000L or it.value.toLong() },
            ProjectStyle.colors.associate { it.key to it.argb },
        )
    }

    @Test
    fun labelsReadLikeTheWebPicker() {
        assertEquals("folder kanban", ProjectStyle.icon("folder-kanban").label)
        assertEquals("Slate", ProjectStyle.color("slate").label)
    }

    @Test
    fun unknownKeysFallBackToDefaults() {
        assertEquals(ProjectStyle.DEFAULT_ICON, ProjectStyle.icon("not-an-icon").key)
        assertEquals(ProjectStyle.DEFAULT_ICON, ProjectStyle.icon(null).key)
        assertEquals(ProjectStyle.DEFAULT_COLOR, ProjectStyle.color("plaid").key)
        assertEquals(ProjectStyle.DEFAULT_COLOR, ProjectStyle.color(null).key)
        assertEquals("rocket", ProjectStyle.icon("rocket").key)
        assertEquals("blue", ProjectStyle.color("blue").key)
    }
}
