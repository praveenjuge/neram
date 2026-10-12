plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ktfmt)
}

android {
    namespace = "com.praveenjuge.neram"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.praveenjuge.neram"
        minSdk = 35
        targetSdk = 37
        versionCode = 1
        versionName = "1.0.0"
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
        }
        release {
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

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
