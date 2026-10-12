package com.praveenjuge.neram.data

import android.content.Context
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.clerk.api.session.GetTokenOptions
import com.clerk.api.session.Session
import dev.convex.android.AuthProvider
import java.util.Base64
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonPrimitive

/**
 * Authenticates Convex with Clerk's `convex` JWT template, the same token the web app sends. The
 * template carries the `org_id`, `name`, and `email` claims the backend reads (`actor()` in
 * packages/convex/convex/model.ts). Clerk's default session token has neither `aud=convex` nor
 * `org_id`, which is why the official clerk-convex-kotlin bridge can't be used here.
 *
 * Template tokens are short-lived (about a minute). The Convex client only asks for a new one after
 * its socket drops, so this provider refreshes ahead of expiry, like convex-js, and pushes each
 * token through `onIdToken`. Tokens are always fetched with `skipCache`: Clerk caches template
 * tokens per session, not per organization, so a cached one can carry the previous workspace's
 * `org_id` right after a switch.
 */
class ClerkConvexAuth(
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
) : AuthProvider<String> {
    /**
     * The running refresh loop and the login generation it belongs to. A new login or a logout
     * bumps the generation, so an older loop can neither publish a token nor keep itself alive.
     */
    private var generation = 0
    private var refresh: Job? = null
    private val lock = Any()

    override suspend fun login(context: Context, onIdToken: (String?) -> Unit): Result<String> =
        start(onIdToken)

    /** Called by the Convex client on every reconnect; always fetches a fresh token. */
    override suspend fun loginFromCache(onIdToken: (String?) -> Unit): Result<String> =
        start(onIdToken)

    /** Signing out of Clerk is the app's job; this only stops token refreshes. */
    override suspend fun logout(context: Context): Result<Void?> {
        synchronized(lock) {
            refresh?.cancel()
            refresh = null
            generation += 1
        }
        return Result.success(null)
    }

    override fun extractIdToken(authResult: String): String = authResult

    private suspend fun start(onIdToken: (String?) -> Unit): Result<String> {
        // Only NeramError becomes a failed login; cancellation must propagate.
        val token =
            try {
                token()
            } catch (error: NeramError) {
                return Result.failure(error)
            }
        synchronized(lock) {
            refresh?.cancel()
            generation += 1
            val current = generation
            refresh = scope.launch { keepFresh(token, current, onIdToken) }
        }
        return Result.success(token)
    }

    /**
     * Fetches the next token ahead of each expiry. Failures (offline, Clerk hiccups) retry with
     * backoff while the session is active; the loop ends on logout, a newer login, or sign-out.
     */
    private suspend fun CoroutineScope.keepFresh(
        first: String,
        current: Int,
        onIdToken: (String?) -> Unit,
    ) {
        var wait = refreshDelaySeconds(first)
        var failures = 0
        while (isActive) {
            delay((wait * 1000).toLong())
            if (!isCurrent(current)) return
            try {
                val next = token()
                if (!isCurrent(current)) return
                onIdToken(next)
                failures = 0
                wait = refreshDelaySeconds(next)
            } catch (signedOut: NeramError.SignedOut) {
                return
            } catch (error: NeramError) {
                failures += 1
                wait = retryDelaySeconds(failures)
            }
        }
    }

    private fun isCurrent(current: Int) = synchronized(lock) { generation == current }

    companion object {
        const val TEMPLATE = "convex"
        /** How long before expiry to fetch the next token. */
        const val REFRESH_LEAD_SECONDS = 15.0

        /** 2, 4, 8 … seconds, capped at 30. */
        fun retryDelaySeconds(failures: Int): Double = min(30.0, 2.0.pow(min(failures, 5)))

        /**
         * Seconds until the next refresh: [REFRESH_LEAD_SECONDS] before the JWT's `exp`, at least 5
         * seconds away; 45 seconds when `exp` can't be read.
         */
        fun refreshDelaySeconds(
            token: String,
            nowSeconds: Double = System.currentTimeMillis() / 1000.0,
        ): Double {
            val expiry = expirySeconds(token) ?: return 45.0
            return max(5.0, expiry - nowSeconds - REFRESH_LEAD_SECONDS)
        }

        fun expirySeconds(token: String): Double? {
            val parts = token.split(".")
            if (parts.size != 3) return null
            return runCatching {
                val payload = Base64.getUrlDecoder().decode(parts[1])
                val claims = Json.parseToJsonElement(String(payload)) as JsonObject
                claims["exp"]?.jsonPrimitive?.doubleOrNull
            }
                .getOrNull()
        }

        private suspend fun token(): String {
            val session = Clerk.activeSession
            if (session == null || session.status != Session.SessionStatus.ACTIVE)
                throw NeramError.SignedOut
            return when (
                val result =
                    Clerk.auth.getToken(GetTokenOptions(template = TEMPLATE, skipCache = true))
            ) {
                is ClerkResult.Success -> result.value
                is ClerkResult.Failure ->
                    throw NeramError.Unexpected(
                        result.throwable?.message ?: "Couldn't get a session token"
                    )
            }
        }
    }
}
