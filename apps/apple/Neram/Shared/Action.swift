import NeramKit
import Observation
import SwiftUI

/// Runs a mutation from a view and surfaces its failure as an alert.
@MainActor
@Observable
final class Action {
  var error: NeramError?
  private(set) var isRunning = false

  /// Returns whether the work finished without an error.
  @discardableResult
  func run(_ work: () async throws(NeramError) -> Void) async -> Bool {
    isRunning = true
    defer { isRunning = false }
    do {
      try await work()
      return true
    } catch {
      self.error = error
      return false
    }
  }
}

extension View {
  func actionAlert(_ action: Action, title: String = "Couldn't save that") -> some View {
    alert(
      title,
      isPresented: Binding(get: { action.error != nil }, set: { if !$0 { action.error = nil } }),
      presenting: action.error
    ) { _ in
      Button("OK") {}
    } message: { error in
      Text(error.localizedDescription)
    }
  }
}
