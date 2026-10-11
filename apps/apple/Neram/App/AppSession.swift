import Foundation
import NeramKit
import Observation

/// Keeps Convex in step with Clerk: which user is signed in and which
/// workspace (Clerk organization) is active.
@MainActor
@Observable
final class AppSession {
  enum Phase: Equatable {
    case idle
    case activating
    case ready
    case failed(String)
  }

  let client: NeramClient
  private(set) var phase: Phase = .idle
  private(set) var isConnected = true
  /// The workspace Convex has finished opening.
  private(set) var activeWorkspaceId: String?

  init(client: NeramClient) {
    self.client = client
  }

  /// Call whenever the signed-in user or active organization changes.
  func update(userId: String?, organizationId: String?) async {
    guard userId != nil else {
      if activeWorkspaceId != nil || phase != .idle {
        await client.signOut()
      }
      activeWorkspaceId = nil
      phase = .idle
      return
    }
    guard let organizationId else {
      phase = .idle
      return
    }
    if organizationId == activeWorkspaceId, phase == .ready { return }
    phase = .activating
    do {
      try await client.activate(workspaceId: organizationId)
      activeWorkspaceId = organizationId
      phase = .ready
    } catch {
      phase = .failed(error.localizedDescription)
    }
  }

  func retry(userId: String?, organizationId: String?) async {
    activeWorkspaceId = nil
    await update(userId: userId, organizationId: organizationId)
  }

  func watchConnection() async {
    await client.watchConnection { isConnected = $0 }
  }
}
