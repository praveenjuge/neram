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

  private let refresh = Mutex<Task<Void, Never>?>(nil)

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
    refresh.withLock { task in
      task?.cancel()
      task = nil
    }
  }

  public func extractIdToken(from authResult: String) -> String { authResult }

  private func start(skipCache: Bool, onIdToken: @Sendable @escaping (String?) -> Void)
    async throws -> String
  {
    let token = try await Self.token(skipCache: skipCache)
    scheduleRefresh(after: token, onIdToken: onIdToken)
    return token
  }

  private func scheduleRefresh(
    after token: String, onIdToken: @Sendable @escaping (String?) -> Void
  ) {
    let delay = Self.refreshDelay(for: token)
    let task = Task { [weak self] in
      try? await Task.sleep(for: .seconds(delay))
      guard !Task.isCancelled, let self else { return }
      do {
        let next = try await Self.token(skipCache: true)
        onIdToken(next)
        self.scheduleRefresh(after: next, onIdToken: onIdToken)
      } catch {
        // Signed out or offline. The client fetches a token when it reconnects.
      }
    }
    refresh.withLock { current in
      current?.cancel()
      current = task
    }
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
