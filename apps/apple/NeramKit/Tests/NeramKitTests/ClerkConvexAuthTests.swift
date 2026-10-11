import Foundation
import Testing

@testable import NeramKit

struct ClerkConvexAuthTests {
  /// An unsigned JWT with the given claims; only the payload matters here.
  static func jwt(_ claims: [String: Any]) throws -> String {
    let payload = try JSONSerialization.data(withJSONObject: claims)
      .base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
    return "eyJhbGciOiJSUzI1NiJ9.\(payload).signature"
  }

  @Test func refreshesFifteenSecondsBeforeExpiry() throws {
    let now = Date(timeIntervalSince1970: 1_000_000)
    let token = try Self.jwt(["exp": 1_000_060, "org_id": "org_1"])
    #expect(ClerkConvexAuth.refreshDelay(for: token, now: now) == 45)
  }

  @Test func neverRefreshesSoonerThanFiveSeconds() throws {
    let now = Date(timeIntervalSince1970: 1_000_000)
    let expired = try Self.jwt(["exp": 999_000])
    #expect(ClerkConvexAuth.refreshDelay(for: expired, now: now) == 5)
  }

  @Test func unreadableTokensFallBackToFortyFiveSeconds() {
    #expect(ClerkConvexAuth.refreshDelay(for: "not-a-jwt") == 45)
    #expect(ClerkConvexAuth.expiry(of: "a.b.c") == nil)
  }
}
