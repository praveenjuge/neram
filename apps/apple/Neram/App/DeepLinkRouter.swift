import ClerkKit
import NeramKit
import Observation
import SwiftUI

/// Holds the Universal Link being opened until the app can show it. A link
/// to another workspace switches to it first (the same path as Clerk's
/// switcher), then ``MainView`` opens the page.
@MainActor
@Observable
final class DeepLinkRouter {
  private(set) var pending: DeepLink?
  /// Why the last link couldn't open, shown once.
  var problem: String?

  func open(_ url: URL) {
    guard let link = DeepLink(url: url) else { return }
    problem = nil
    // The workspace picker link only brings the app forward.
    pending = link.slug == nil ? nil : link
  }

  /// Takes the pending link if it belongs to the active workspace.
  func take(forWorkspace slug: String?) -> DeepLink? {
    guard let link = pending, slug != nil, link.slug == slug else { return nil }
    pending = nil
    return link
  }

  /// Makes the link's workspace active when it isn't already. Signed-out
  /// users keep the link until they sign in.
  func switchWorkspaceIfNeeded(clerk: Clerk) async {
    guard let slug = pending?.slug, clerk.isLoaded, let user = clerk.user,
      let session = clerk.session, clerk.organization?.slug != slug
    else { return }
    do {
      let memberships = try await user.getOrganizationMemberships(pageSize: 100).data
      guard pending?.slug == slug else { return }
      guard let membership = memberships.first(where: { $0.organization.slug == slug }) else {
        pending = nil
        problem = "You're not a member of that workspace, or it no longer exists."
        return
      }
      try await clerk.auth.setActive(
        sessionId: session.id, organizationId: membership.organization.id)
    } catch {
      pending = nil
      problem = error.localizedDescription
    }
  }
}

extension View {
  /// Shows why a link couldn't open.
  func deepLinkAlert(_ router: DeepLinkRouter) -> some View {
    alert(
      "Couldn't open that link",
      isPresented: Binding(
        get: { router.problem != nil }, set: { if !$0 { router.problem = nil } })
    ) {
      Button("OK", role: .cancel) {}
    } message: {
      Text(router.problem ?? "")
    }
  }
}
