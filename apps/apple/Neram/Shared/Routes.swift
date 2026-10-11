import NeramKit
import SwiftUI

/// Every screen a tab's navigation stack can push.
enum AppRoute: Hashable {
  case project(DocumentID)
  case task(DocumentID)
  case archived
}

extension View {
  /// Registers the destinations for ``AppRoute`` on a navigation stack.
  func appDestinations() -> some View {
    navigationDestination(for: AppRoute.self) { route in
      switch route {
      case .project(let id): ProjectView(projectId: id)
      case .task(let id): TaskView(taskId: id)
      case .archived: ArchivedProjectsView()
      }
    }
  }
}
