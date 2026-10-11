package com.praveenjuge.neram.data

import kotlinx.serialization.json.Json

/** Decodes Convex results. Unknown fields are ignored so additive backend changes don't break. */
val NeramJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
}
