import ClerkKit
import ConvexMobile

/// Authenticates Convex with Clerk's `convex` JWT template, the same token the
/// web app sends. The template carries the `org_id`, `name`, and `email` claims
/// the backend reads (`actor()` in packages/convex/convex/model.ts). Clerk's
/// default session token has neither `aud=convex` nor `org_id`, which is why the
/// official clerk-convex-swift bridge can't be used here.
///
/// Convex pulls a fresh token through ``loginFromCache(onIdToken:)`` whenever
/// the current one expires. After switching organizations, call
/// `ConvexClientWithAuth.login()` so the next token carries the new `org_id`.
public final class ClerkConvexAuth: AuthProvider, Sendable {
  public typealias T = String

  static let template = "convex"

  public init() {}

  public func login(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> String {
    try await Self.token(skipCache: true)
  }

  public func loginFromCache(onIdToken: @Sendable @escaping (String?) -> Void) async throws
    -> String
  {
    try await Self.token(skipCache: false)
  }

  /// Signing out of Clerk is the app's job; this only clears Convex auth.
  public func logout() async throws {}

  public func extractIdToken(from authResult: String) -> String { authResult }

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
