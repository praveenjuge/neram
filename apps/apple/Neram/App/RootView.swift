import ClerkKit
import ClerkKitUI
import SwiftUI

/// Signed out → Clerk sign-in. Signed in without a workspace → Clerk's
/// organization list. Otherwise the app, once Convex knows the workspace.
struct RootView: View {
  @Environment(Clerk.self) private var clerk
  @Environment(AppSession.self) private var session

  var body: some View {
    content
      .task(id: Identity(userId: clerk.user?.id, organizationId: clerk.organization?.id)) {
        await session.update(userId: clerk.user?.id, organizationId: clerk.organization?.id)
      }
      .task { await session.watchConnection() }
  }

  @ViewBuilder private var content: some View {
    if !clerk.isLoaded {
      ProgressView()
    } else if clerk.user == nil {
      AuthView(isDismissible: false)
    } else if clerk.organization == nil {
      OrganizationListView(
        hidePersonal: true, isDismissible: false, skipInvitationScreen: true)
    } else {
      switch session.phase {
      case .idle, .activating:
        ProgressView("Opening your workspace…")
      case .failed(let message):
        WorkspaceUnavailableView(message: message) {
          Task {
            await session.retry(userId: clerk.user?.id, organizationId: clerk.organization?.id)
          }
        }
      case .ready:
        MainView()
          .id(clerk.organization?.id)
      }
    }
  }
}

private struct Identity: Equatable {
  var userId: String?
  var organizationId: String?
}

private struct WorkspaceUnavailableView: View {
  let message: String
  let retry: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label("Couldn't open this workspace", systemImage: "exclamationmark.triangle")
    } description: {
      Text(message)
    } actions: {
      Button("Try Again", action: retry)
        .buttonStyle(.borderedProminent)
      OrganizationSwitcher(hidePersonal: true, skipInvitationScreen: true)
      UserButton()
    }
  }
}
