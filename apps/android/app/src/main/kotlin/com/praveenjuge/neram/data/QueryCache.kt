package com.praveenjuge.neram.data

import java.io.File
import java.security.MessageDigest

/**
 * Last-seen query results as JSON files, one folder per workspace. Read-only data for instant
 * launches and offline viewing; edits always go to Convex.
 */
class QueryCache(private val root: File) {
    fun read(key: String, scope: String): String? = runCatching {
        file(key, scope).takeIf { it.exists() }?.readText()
    }
        .getOrNull()

    fun write(json: String, key: String, scope: String) {
        // The cache is best effort; live data still flows without it.
        runCatching {
            val file = file(key, scope)
            file.parentFile?.mkdirs()
            val temp = File(file.parentFile, "${file.name}.tmp")
            temp.writeText(json)
            temp.renameTo(file)
        }
    }

    /** Whether anything is saved for [scope], so the app can open it offline. */
    fun has(scope: String): Boolean = folder(scope).list()?.isNotEmpty() == true

    fun clear() {
        root.deleteRecursively()
    }

    private fun file(key: String, scope: String): File {
        val name =
            MessageDigest.getInstance("SHA-256").digest(key.toByteArray()).joinToString("") {
                "%02x".format(it)
            }
        return File(folder(scope), "$name.json")
    }

    private fun folder(scope: String) =
        File(root, scope.filter { it.isLetterOrDigit() || it == '_' })
}
