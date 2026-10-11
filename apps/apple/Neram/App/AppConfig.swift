import Foundation

/// Public build settings from Config/*.xcconfig, surfaced through Info.plist.
enum AppConfig {
  static let clerkPublishableKey = value("CLERK_PUBLISHABLE_KEY")
  static let convexURL = value("CONVEX_URL")
  /// Unset in Debug, so development crashes stay local.
  static let sentryDSN = optionalValue("SENTRY_DSN")

  private static func optionalValue(_ key: String) -> String? {
    guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String, !value.isEmpty
    else { return nil }
    return value
  }

  private static func value(_ key: String) -> String {
    guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String, !value.isEmpty
    else {
      fatalError("\(key) is missing. Set it in apps/apple/Config/*.xcconfig.")
    }
    return value
  }
}
