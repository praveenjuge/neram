package com.praveenjuge.neram

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.praveenjuge.neram.ui.DeepLinkRouter
import com.praveenjuge.neram.ui.RootScreen
import com.praveenjuge.neram.ui.theme.NeramTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject lateinit var links: DeepLinkRouter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // A recreated activity has already handled the link it was started with.
        if (savedInstanceState == null) links.open(intent?.dataString)
        setContent { NeramTheme { RootScreen() } }
    }

    /** App Links that arrive while the app is open (the activity is single-top). */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        links.open(intent.dataString)
    }
}
