package com.praveenjuge.neram

import android.app.Application
import com.clerk.api.Clerk
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class NeramApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Clerk.initialize(this, BuildConfig.CLERK_PUBLISHABLE_KEY)
    }
}
