import Sentry

/// Crash and error reports through Sentry, identified by the Clerk user ID
/// only: no names, emails, or other personal data.
enum CrashReporting {
  static func start() {
    guard let dsn = AppConfig.sentryDSN else { return }
    SentrySDK.start { options in
      options.dsn = dsn
      options.sendDefaultPii = false
      #if DEBUG
        options.environment = "development"
      #else
        options.environment = "production"
      #endif
    }
  }

  static func setUser(id: String?) {
    guard SentrySDK.isEnabled else { return }
    SentrySDK.setUser(id.map { User(userId: $0) })
  }
}
