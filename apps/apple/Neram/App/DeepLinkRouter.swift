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
  /// users keep the link until they sign in. Runs from `.task(id:)`, so a
  /// newer link cancels this one; results for a replaced link are ignored.
  func switchWorkspaceIfNeeded(clerk: Clerk) async {
    guard let link = pending, let slug = link.slug, clerk.isLoaded, let user = clerk.user,
      let session = clerk.session, clerk.organization?.slug != slug
    else { return }
    do {
      guard let organizationId = try await organizationId(for: slug, user: user) else {
        guard isCurrent(link) else { return }
        pending = nil
        problem = "You're not a member of that workspace, or it no longer exists."
        return
      }
      guard isCurrent(link) else { return }
      try await clerk.auth.setActive(sessionId: session.id, organizationId: organizationId)
    } catch {
      guard isCurrent(link) else { return }
      pending = nil
      problem = error.localizedDescription
    }
  }

  private func isCurrent(_ link: DeepLink) -> Bool {
    !Task.isCancelled && pending == link
  }

  /// Looks through every membership page, like the web's workspace gate.
  private func organizationId(for slug: String, user: User) async throws -> String? {
    let pageSize = 100
    var page = 1
    while true {
      let response = try await user.getOrganizationMemberships(page: page, pageSize: pageSize)
      if let match = response.data.first(where: { $0.organization.slug == slug }) {
        return match.organization.id
      }
      guard response.data.count == pageSize, page * pageSize < response.totalCount else {
        return nil
      }
      page += 1
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
