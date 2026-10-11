import ClerkKit
import ConvexMobile
import Foundation
import Synchronization

/// Authenticates Convex with Clerk's `convex` JWT template, the same token the
/// web app sends. The template carries the `org_id`, `name`, and `email` claims
/// the backend reads (`actor()` in packages/convex/convex/model.ts). Clerk's
/// default session token has neither `aud=convex` nor `org_id`, which is why the
/// official clerk-convex-swift bridge can't be used here.
///
/// Template tokens are short-lived (about a minute). The Convex client only
/// asks for a new one after its socket drops, so this provider refreshes ahead
/// of expiry, like convex-js, and pushes each token through `onIdToken`.
/// After switching organizations, call `ConvexClientWithAuth.login()` so the
/// next token carries the new `org_id`.
public final class ClerkConvexAuth: AuthProvider, Sendable {
  public typealias T = String

  static let template = "convex"
  /// How long before expiry to fetch the next token.
  static let refreshLead: TimeInterval = 15

  /// The running refresh loop and the login generation it belongs to. A new
  /// login or a logout bumps the generation, so an older loop can neither
  /// publish a token nor keep itself alive.
  private let refresh = Mutex<(generation: Int, task: Task<Void, Never>?)>((0, nil))

  public init() {}

  public func login(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> String {
    try await start(skipCache: true, onIdToken: onIdToken)
  }

  public func loginFromCache(onIdToken: @Sendable @escaping (String?) -> Void) async throws
    -> String
  {
    try await start(skipCache: false, onIdToken: onIdToken)
  }

  /// Signing out of Clerk is the app's job; this only stops token refreshes.
  public func logout() async throws {
    refresh.withLock { state in
      state.task?.cancel()
      state = (state.generation + 1, nil)
    }
  }

  public func extractIdToken(from authResult: String) -> String { authResult }

  private func start(skipCache: Bool, onIdToken: @Sendable @escaping (String?) -> Void)
    async throws -> String
  {
    let token = try await Self.token(skipCache: skipCache)
    let generation = refresh.withLock { state in
      state.task?.cancel()
      state = (state.generation + 1, nil)
      return state.generation
    }
    let task = Task { [weak self] in
      guard let self else { return }
      await self.keepFresh(after: token, generation: generation, onIdToken: onIdToken)
    }
    refresh.withLock { state in
      if state.generation == generation { state.task = task } else { task.cancel() }
    }
    return token
  }

  /// Fetches the next token ahead of each expiry. Failures (offline, Clerk
  /// hiccups) retry with backoff while the session is active; the loop ends on
  /// logout, a newer login, or sign-out.
  private func keepFresh(
    after token: String, generation: Int, onIdToken: @Sendable @escaping (String?) -> Void
  ) async {
    var delay = Self.refreshDelay(for: token)
    var failures = 0
    while true {
      try? await Task.sleep(for: .seconds(delay))
      guard isCurrent(generation) else { return }
      do {
        let next = try await Self.token(skipCache: true)
        guard isCurrent(generation) else { return }
        onIdToken(next)
        failures = 0
        delay = Self.refreshDelay(for: next)
      } catch NeramError.signedOut {
        return
      } catch {
        failures += 1
        delay = Self.retryDelay(afterFailures: failures)
      }
    }
  }

  private func isCurrent(_ generation: Int) -> Bool {
    !Task.isCancelled && refresh.withLock { $0.generation == generation }
  }

  /// 2, 4, 8 … seconds, capped at 30.
  static func retryDelay(afterFailures failures: Int) -> TimeInterval {
    min(30, pow(2, Double(min(failures, 5))))
  }

  /// Seconds until the next refresh: `refreshLead` before the JWT's `exp`,
  /// at least 5 seconds away; 45 seconds when `exp` can't be read.
  static func refreshDelay(for token: String, now: Date = .now) -> TimeInterval {
    guard let expiry = expiry(of: token) else { return 45 }
    return max(5, expiry.timeIntervalSince(now) - refreshLead)
  }

  static func expiry(of token: String) -> Date? {
    let parts = token.split(separator: ".")
    guard parts.count == 3 else { return nil }
    var payload = parts[1].replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/")
    payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
    guard let data = Data(base64Encoded: payload),
      let claims = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let exp = claims["exp"] as? Double
    else { return nil }
    return Date(timeIntervalSince1970: exp)
  }

  @MainActor
  private static func token(skipCache: Bool) async throws -> String {
    guard let session = Clerk.shared.session, session.status == .active,
      let token = try await session.getToken(.init(template: template, skipCache: skipCache))
    else {
      throw NeramError.signedOut
    }
    return token
  }
}
