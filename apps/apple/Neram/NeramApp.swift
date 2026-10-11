import ClerkKit
import NeramKit
import SwiftUI

@main
struct NeramApp: App {
  @State private var session: AppSession
  @State private var links = DeepLinkRouter()

  init() {
    CrashReporting.start()
    Clerk.configure(publishableKey: AppConfig.clerkPublishableKey)
    _session = State(
      initialValue: AppSession(client: NeramClient(deploymentURL: AppConfig.convexURL)))
  }

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(Clerk.shared)
        .environment(session)
        .environment(links)
        .onOpenURL { links.open($0) }
    }
  }
}
