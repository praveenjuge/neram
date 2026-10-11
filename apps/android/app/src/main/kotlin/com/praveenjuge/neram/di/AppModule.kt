package com.praveenjuge.neram.di

import android.content.Context
import com.praveenjuge.neram.BuildConfig
import com.praveenjuge.neram.data.AppSession
import com.praveenjuge.neram.data.NeramClient
import com.praveenjuge.neram.data.QueryCache
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import java.io.File
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun client(@ApplicationContext context: Context): NeramClient =
        NeramClient(
            context = context,
            deploymentUrl = BuildConfig.CONVEX_URL,
            cache = QueryCache(File(context.cacheDir, "neram-queries")),
        )

    @Provides @Singleton fun session(client: NeramClient): AppSession = AppSession(client)
}
