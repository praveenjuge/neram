import ClerkKit
import ClerkKitUI
import NeramKit
import SwiftUI

/// Tab bar on iPhone; sidebar on iPad and Mac. Universal Links pick the tab
/// and push the page, the same places the web URL points to.
struct MainView: View {
  enum Section: Hashable { case home, tasks, focus, activity }

  @Environment(AppSession.self) private var session
  @Environment(DeepLinkRouter.self) private var links
  @Environment(Clerk.self) private var clerk
  @State private var selection: Section = .home
  @State private var paths: [Section: [AppRoute]] = [:]

  var body: some View {
    TabView(selection: $selection) {
      Tab("Home", systemImage: "house", value: Section.home) {
        HomeView(path: path(.home))
      }
      Tab("My Tasks", systemImage: "checklist", value: Section.tasks) {
        NavigationStack(path: path(.tasks)) { MyTasksView().appDestinations() }
      }
      Tab("Focus", systemImage: "scope", value: Section.focus) {
        NavigationStack(path: path(.focus)) { FocusView().appDestinations() }
      }
      Tab("Activity", systemImage: "clock", value: Section.activity) {
        NavigationStack(path: path(.activity)) { ActivityView().appDestinations() }
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
    .onChange(of: links.pending, initial: true) {
      if let link = links.take(forWorkspace: clerk.organization?.slug) { show(link) }
    }
  }

  private func path(_ section: Section) -> Binding<[AppRoute]> {
    Binding(get: { paths[section] ?? [] }, set: { paths[section] = $0 })
  }

  private func show(_ link: DeepLink) {
    switch link.destination {
    case .dashboard:
      open(.home, [])
    case .project(let project, let task, let comment):
      open(.home, [.project(project)] + (task.map { [.task($0, comment: comment)] } ?? []))
    case .tasks(let task):
      open(.tasks, task.map { [.task($0)] } ?? [])
    case .sprints:
      open(.focus, [])
    case .activity:
      open(.activity, [])
    case .archived:
      open(.home, [.archived])
    }
  }

  private func open(_ section: Section, _ routes: [AppRoute]) {
    selection = section
    paths[section] = routes
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
