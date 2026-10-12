package com.praveenjuge.neram.data

import android.content.Context
import dev.convex.android.ConvexClientWithAuth
import dev.convex.android.ConvexError
import dev.convex.android.InternalError
import dev.convex.android.ServerError
import dev.convex.android.WebSocketState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.JsonElement

/**
 * The app's single Convex connection, authenticated with Clerk.
 *
 * Queries stream live values; the last value of each query is cached per workspace so screens can
 * show it instantly and while offline. Results arrive as raw JSON and are decoded here, so a shape
 * mismatch surfaces as an error instead of the stream silently ending.
 */
class NeramClient(
    private val context: Context,
    deploymentUrl: String,
    private val cache: QueryCache,
) {
    val convex = ConvexClientWithAuth(deploymentUrl, ClerkConvexAuth())

    /** The signed-in user's open workspace, as the cache folder for its saved results. */
    @Volatile private var scope: String? = null

    /** False while showing saved data for a workspace that isn't open online yet. */
    @Volatile private var live = false

    val isLive: Boolean
        get() = live

    /**
     * Authenticates Convex for the active Clerk organization and projects it into Convex. Call
     * after sign-in and after every organization switch: `login()` fetches a token with the new
     * `org_id`, and `syncCurrent` makes sure the backend knows the workspace before any query runs.
     */
    suspend fun activate(userId: String, workspaceId: String) {
        // Detach the previous workspace first so its subscriptions stop delivering (and caching)
        // results fetched with the new token.
        scope = null
        live = false
        convex.login(context).getOrElse { throw NeramError.from(it) }
        scope = cacheScope(userId, workspaceId)
        run(Calls.syncCurrentOrganization)
        live = true
    }

    /** Whether the user has saved data for [workspaceId] to show before it opens online. */
    fun hasSavedData(userId: String, workspaceId: String): Boolean =
        cache.has(cacheScope(userId, workspaceId))

    /** Shows [workspaceId]'s saved data while it can't be opened yet (offline or slow network). */
    fun useSavedData(userId: String, workspaceId: String) {
        live = false
        scope = cacheScope(userId, workspaceId)
    }

    /** Drops Convex auth and every cached workspace snapshot. */
    suspend fun signOut() {
        scope = null
        live = false
        convex.logout(context)
        cache.clear()
    }

    /**
     * Streams [query]. When [cached], the last stored value is emitted first. While showing saved
     * data, only that value is emitted: the screens subscribe again once the workspace is open.
     */
    fun <T> observe(query: Query<T>, cached: Boolean = true): Flow<T> = flow {
        val current = scope
        var showedSaved = false
        if (cached && current != null) {
            cache.read(query.key, current)?.let { json ->
                runCatching { NeramJson.decodeFromString(query.serializer, json) }
                    .onSuccess {
                        emit(it)
                        showedSaved = true
                    }
            }
        }
        if (!live) {
            if (!showedSaved) throw NeramError.NotSaved
            awaitCancellation()
        }
        convex
            .subscribe<JsonElement>(query.name, query.args)
            // Starting a subscription can throw the client's own errors (for example
            // "channel closed" when the connection drops); surface them like any other failure.
            .catch { throw NeramError.from(it) }
            .collect { result ->
                // A result from before a workspace switch belongs to neither workspace.
                if (current != scope) throw CancellationException("Workspace changed")
                val element = result.getOrElse { throw NeramError.from(it) }
                val value = runCatching {
                    NeramJson.decodeFromJsonElement(query.serializer, element)
                }
                    .getOrElse {
                        throw NeramError.Unexpected("Couldn't read ${query.name}: ${it.message}")
                    }
                emit(value)
                if (cached && current != null) cache.write(element.toString(), query.key, current)
            }
    }

    /** Runs a mutation or action. */
    suspend fun <T> run(call: Call<T>): T {
        val element: JsonElement =
            try {
                when (call.kind) {
                    Call.Kind.Mutation -> convex.mutation<JsonElement>(call.name, call.args)
                    Call.Kind.Action -> convex.action<JsonElement>(call.name, call.args)
                }
            } catch (error: ConvexError) {
                throw NeramError.from(error)
            } catch (error: ServerError) {
                throw NeramError.from(error)
            } catch (error: InternalError) {
                throw NeramError.from(error)
            }
        return runCatching { NeramJson.decodeFromJsonElement(call.serializer, element) }
            .getOrElse { throw NeramError.Unexpected("Couldn't read ${call.name}: ${it.message}") }
    }

    /** Whether the WebSocket to Convex is connected, for the offline banner. */
    val isConnected: Flow<Boolean> =
        convex.webSocketStateFlow.map { it == WebSocketState.CONNECTED }.distinctUntilChanged()

    val isOnline: Boolean
        get() = convex.webSocketStateFlow.value == WebSocketState.CONNECTED

    /**
     * Saved results are kept per user as well as per workspace: some results (such as activity
     * notices) belong to one member, and another account can sign in on the same device.
     */
    private fun cacheScope(userId: String, workspaceId: String) = "${userId}__$workspaceId"
}
