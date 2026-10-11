import NeramKit
import SwiftUI

/// Every screen a tab's navigation stack can push.
enum AppRoute: Hashable {
  case project(DocumentID)
  /// A task, optionally opened at one of its comments.
  case task(DocumentID, comment: DocumentID? = nil)
  case archived
}

extension View {
  /// Registers the destinations for ``AppRoute`` on a navigation stack.
  func appDestinations() -> some View {
    navigationDestination(for: AppRoute.self) { route in
      switch route {
      case .project(let id): ProjectView(projectId: id)
      case .task(let id, let comment): TaskView(taskId: id, commentId: comment)
      case .archived: ArchivedProjectsView()
      }
    }
  }
}
