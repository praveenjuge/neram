import Combine
@preconcurrency import ConvexMobile
import Foundation

/// The app's single Convex connection, authenticated with Clerk.
///
/// Queries stream live values; the last value of each query is cached per
/// workspace so screens can show it instantly and while offline.
@MainActor
public final class NeramClient {
  public let convex: ConvexClientWithAuth<String>
  private let cache: QueryCache
  private var workspaceId: String?

  public init(deploymentURL: String, cache: QueryCache = QueryCache()) {
    self.convex = ConvexClientWithAuth(
      deploymentUrl: deploymentURL, authProvider: ClerkConvexAuth())
    self.cache = cache
  }

  /// Authenticates Convex for the active Clerk organization and projects it
  /// into Convex. Call after sign-in and after every organization switch:
  /// `login()` fetches a token with the new `org_id`, and `syncCurrent` makes
  /// sure the backend knows the workspace before any query runs.
  public func activate(workspaceId: String) async throws(NeramError) {
    // Detach the previous workspace first so its subscriptions stop
    // delivering (and caching) results fetched with the new token.
    self.workspaceId = nil
    if case let .failure(error) = await convex.login() {
      throw NeramError(error)
    }
    self.workspaceId = workspaceId
    _ = try await run(Calls.syncCurrentOrganization)
  }

  /// Drops Convex auth and every cached workspace snapshot.
  public func signOut() async {
    workspaceId = nil
    await convex.logout()
    cache.clear()
  }

  /// Streams `query` into `onValue` until the calling task is cancelled.
  /// When `cached`, the last stored value is delivered first.
  public func observe<Value>(
    _ query: Query<Value>, cached: Bool = true, _ onValue: (Value) -> Void
  ) async throws(NeramError) {
    let scope = workspaceId
    if cached, let scope, let snapshot = cache.read(Value.self, key: query.key, scope: scope) {
      onValue(snapshot)
    }
    let updates = convex.subscribe(
      to: query.name, with: query.args.encodable, yielding: Value.self
    ).values
    do {
      for try await value in updates {
        // A result from before a workspace switch belongs to neither workspace.
        guard scope == workspaceId else { return }
        onValue(value)
        if cached, let scope { cache.write(value, key: query.key, scope: scope) }
      }
    } catch {
      if error is CancellationError { return }
      throw NeramError(error)
    }
  }

  /// Runs a mutation or action.
  @discardableResult
  public func run<Value>(_ call: Call<Value>) async throws(NeramError) -> Value {
    do {
      switch call.kind {
      case .mutation:
        return try await convex.mutation(call.name, with: call.args.encodable)
      case .action:
        return try await convex.action(call.name, with: call.args.encodable)
      }
    } catch {
      throw NeramError(error)
    }
  }

  /// Reports whether the WebSocket to Convex is connected, for the offline
  /// banner, until the calling task is cancelled.
  public func watchConnection(_ onChange: (Bool) -> Void) async {
    // Map inside the loop, not with Combine operators: ConvexMobile publishes
    // on its WebSocket thread, and a closure written here is main-actor
    // isolated, so running it there trips Swift's isolation check.
    var last: Bool?
    for await state in convex.watchWebSocketState().values {
      let connected = state == .connected
      if connected != last {
        last = connected
        onChange(connected)
      }
    }
  }
}
