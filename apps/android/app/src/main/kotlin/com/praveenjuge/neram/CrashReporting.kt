package com.praveenjuge.neram

import android.content.Context
import io.sentry.Sentry
import io.sentry.android.core.SentryAndroid
import io.sentry.protocol.User

/**
 * Crash and error reports through Sentry, identified by the Clerk user ID only: no names, emails,
 * or other personal data (Sentry sends none by default). Off when the build has no DSN (debug
 * builds). Mirrors the Apple app.
 */
object CrashReporting {
    fun start(context: Context) {
        val dsn = BuildConfig.SENTRY_DSN
        if (dsn.isEmpty()) return
        SentryAndroid.init(context) { options ->
            options.dsn = dsn
            options.environment = if (BuildConfig.DEBUG) "development" else "production"
        }
    }

    fun setUser(id: String?) {
        if (!Sentry.isEnabled()) return
        Sentry.setUser(id?.let { User().apply { this.id = it } })
    }
}
