package com.praveenjuge.neram.data

import dev.convex.android.ClientException
import dev.convex.android.ConvexError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DataTest {
    @Test
    fun failedRefreshesBackOffUpToThirtySeconds() {
        assertEquals(
            listOf(2.0, 4.0, 8.0, 16.0, 30.0, 30.0),
            (1..6).map { ClerkConvexAuth.retryDelaySeconds(it) },
        )
    }

    @Test
    fun refreshHappensFifteenSecondsBeforeExpiry() {
        val token = jwt("""{"exp":1000}""")
        assertEquals(1000.0, ClerkConvexAuth.expirySeconds(token)!!, 0.0)
        assertEquals(45.0, ClerkConvexAuth.refreshDelaySeconds(token, nowSeconds = 940.0), 0.0)
        // Never sooner than five seconds, and a fallback when `exp` is missing.
        assertEquals(5.0, ClerkConvexAuth.refreshDelaySeconds(token, nowSeconds = 999.0), 0.0)
        assertEquals(45.0, ClerkConvexAuth.refreshDelaySeconds("not-a-jwt"), 0.0)
        assertNull(ClerkConvexAuth.expirySeconds(jwt("""{"sub":"x"}""")))
    }

    @Test
    fun convexErrorsDecodeTheirPayload() {
        val error =
            NeramError.from(
                ConvexError(
                    "boom",
                    """{"code":"EDIT_CONFLICT","message":"Changed.","field":"title"}""",
                )
            )
        assertTrue(error is NeramError.Server)
        assertEquals("EDIT_CONFLICT", error.code)
        assertEquals("Changed.", error.message)
        assertTrue(NeramError.from(ConvexError("boom", "not json")) is NeramError.Unexpected)
        // Raw client failures (e.g. a dropped connection) become ordinary errors, not crashes.
        assertTrue(
            NeramError.from(ClientException.InternalException("channel closed"))
                is NeramError.Unexpected
        )
    }

    @Test
    fun queryKeysIgnoreArgumentOrder() {
        val a = Query("x:y", mapOf("b" to 1.0, "a" to listOf("q", null)), NoResult)
        val b = Query("x:y", mapOf("a" to listOf("q", null), "b" to 1.0), NoResult)
        assertEquals(a.key, b.key)
        assertEquals("""x:y{"a":["q",null],"b":1.0}""", a.key)
    }

    @Test
    fun pageRequestsSendNumbersAsDoubles() {
        val args = PageRequest(20, cursor = "c", endCursor = "e").arg
        assertEquals(20.0, args["numItems"])
        assertEquals("e", args["endCursor"])
        assertTrue("endCursor" !in PageRequest(20).arg)
    }

    private fun jwt(payload: String): String {
        val encoder = java.util.Base64.getUrlEncoder().withoutPadding()
        return "e30." + encoder.encodeToString(payload.toByteArray()) + ".sig"
    }

    @Test
    fun limitsCountUtf16UnitsAndKeepWholeCharacters() {
        assertEquals(80, "a".repeat(90).prefixUtf16(80).length)
        // 41 rockets are 82 UTF-16 units; only 40 whole ones fit in 80.
        val rockets = "🚀".repeat(41)
        assertEquals(80, rockets.prefixUtf16(80).length)
        assertEquals("🚀".repeat(40), rockets.prefixUtf16(80))
        // A family emoji is one character of 8 units, so it's kept whole or not at all.
        assertEquals("ab", "ab👨‍👩‍👧".prefixUtf16(5))
        assertEquals("ok", "ok".prefixUtf16(80))
    }
}
