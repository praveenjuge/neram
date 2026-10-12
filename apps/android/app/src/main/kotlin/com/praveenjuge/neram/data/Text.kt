package com.praveenjuge.neram.data

import java.text.BreakIterator

/**
 * The longest prefix of whole characters that fits in [limit] UTF-16 code units. Server limits
 * count JavaScript string length (UTF-16, the same as Kotlin's), and cutting at a character
 * boundary keeps emoji and accented letters intact.
 */
fun String.prefixUtf16(limit: Int): String {
    if (length <= limit) return this
    val characters = BreakIterator.getCharacterInstance()
    characters.setText(this)
    var end = 0
    while (true) {
        val next = characters.next()
        if (next == BreakIterator.DONE || next > limit) return substring(0, end)
        end = next
    }
}
