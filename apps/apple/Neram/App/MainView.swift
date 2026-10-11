import ClerkKitUI
import SwiftUI

/// Tab bar on iPhone; sidebar on iPad and Mac.
struct MainView: View {
  @Environment(AppSession.self) private var session

  var body: some View {
    TabView {
      Tab("Home", systemImage: "house") {
        HomeView()
      }
      Tab("My Tasks", systemImage: "checklist") {
        NavigationStack { MyTasksView() }
      }
      Tab("Focus", systemImage: "scope") {
        NavigationStack { FocusView() }
      }
      Tab("Activity", systemImage: "clock") {
        NavigationStack { ActivityView() }
      }
    }
    .tabViewStyle(.sidebarAdaptable)
    .safeAreaInset(edge: .top, spacing: 0) {
      if !session.isConnected {
        Label("Offline. Showing saved data; changes are paused.", systemImage: "wifi.slash")
          .font(.footnote)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 6)
          .background(.bar)
      }
    }
  }
}

/// Workspace switching and the account menu, shown on every top-level screen.
struct AccountToolbar: ToolbarContent {
  var body: some ToolbarContent {
    ToolbarItem(placement: .navigation) {
      OrganizationSwitcher(hidePersonal: true, skipInvitationScreen: true)
    }
    ToolbarItem(placement: .primaryAction) {
      UserButton()
    }
  }
}
