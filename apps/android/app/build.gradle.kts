plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ktfmt)
    alias(libs.plugins.sentry)
}

android {
    namespace = "com.praveenjuge.neram"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.praveenjuge.neram"
        minSdk = 35
        targetSdk = 37
        // The release lane passes the next Play version code; local builds use 1.
        versionCode = providers.gradleProperty("versionCode").map(String::toInt).getOrElse(1)
        versionName = "1.0.0"
    }

    // The Play upload key, from the environment (the release workflow writes the keystore from a
    // secret). Without it, release builds are unsigned, which is fine for local checks.
    val uploadKeystore =
        providers.environmentVariable("ANDROID_UPLOAD_KEYSTORE").orNull?.takeIf { it.isNotBlank() }
    signingConfigs {
        if (uploadKeystore != null) {
            create("upload") {
                storeFile = file(uploadKeystore)
                storePassword = providers.environmentVariable("ANDROID_UPLOAD_STORE_PASSWORD").get()
                keyAlias = providers.environmentVariable("ANDROID_UPLOAD_KEY_ALIAS").get()
                keyPassword = providers.environmentVariable("ANDROID_UPLOAD_KEY_PASSWORD").get()
            }
        }
    }

    buildTypes {
        // Public values only: Clerk publishable keys and Convex deployment URLs.
        debug {
            applicationIdSuffix = ".debug"
            buildConfigField(
                "String",
                "CLERK_PUBLISHABLE_KEY",
                "\"pk_test_c2Vuc2libGUtbGFjZXdpbmctMTguY2xlcmsuYWNjb3VudHMuZGV2JA\"",
            )
            buildConfigField(
                "String",
                "CONVEX_URL",
                "\"https://energized-guineapig-888.convex.cloud\"",
            )
            // Debug builds don't report crashes.
            buildConfigField("String", "SENTRY_DSN", "\"\"")
        }
        release {
            signingConfig = signingConfigs.findByName("upload")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            buildConfigField(
                "String",
                "CLERK_PUBLISHABLE_KEY",
                "\"pk_live_Y2xlcmsubmVyYW0ucHJhdmVlbmp1Z2UuY29tJA\"",
            )
            buildConfigField("String", "CONVEX_URL", "\"https://impartial-clam-554.convex.cloud\"")
            // A DSN only lets a client send events, so it's safe to ship in the app.
            buildConfigField("String", "SENTRY_DSN", "\"\"")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions { unitTests.isReturnDefaultValues = true }
}

kotlin { jvmToolchain(21) }

ktfmt { kotlinLangStyle() }

// Crash reports only, like the Apple app: no tracing instrumentation or source context. R8 mapping
// files upload when SENTRY_AUTH_TOKEN is set (the release workflow), so stack traces read clearly.
sentry {
    org = "teakvault"
    projectName = "neram-android"
    // An unset Actions secret arrives as an empty string, so blank counts as absent.
    val token =
        providers.environmentVariable("SENTRY_AUTH_TOKEN").orNull?.takeIf { it.isNotBlank() }
    authToken = token
    autoUploadProguardMapping = token != null
    includeSourceContext = false
    tracingInstrumentation { enabled = false }
    autoInstallation { enabled = false }
    telemetry = false
}

dependencies {
    implementation(libs.androidx.core)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.viewmodel.navigation3)
    implementation(libs.androidx.navigation3.runtime)
    implementation(libs.androidx.navigation3.ui)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.hilt.viewmodel.compose)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material3.navigation.suite)
    implementation(libs.compose.material3.adaptive)
    implementation(libs.compose.material3.adaptive.navigation3)
    implementation(libs.compose.material.icons)
    debugImplementation(libs.compose.ui.tooling)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.clerk.api)
    implementation(libs.clerk.ui)
    implementation(libs.convex)
    implementation(libs.sentry.android)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
