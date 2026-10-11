import NeramKit
import Observation
import SwiftUI

/// Moves tasks between statuses and positions. Keeps the move visible until
/// the live query confirms it (the native SDK has no optimistic updates) and
/// asks before marking a task Done while it has open subtasks.
@MainActor
@Observable
final class TaskMoves {
  struct Pending {
    let id = UUID()
    var status: TaskStatus
    var position: Double?
  }

  /// A Done move the server refused because subtasks are still open.
  struct IncompleteMove: Identifiable {
    let task: TaskItem
    let position: Double?
    let unfinished: Int
    var id: DocumentID { task.id }
  }

  private(set) var pending: [DocumentID: Pending] = [:]
  var incomplete: IncompleteMove?
  let action = Action()

  /// `tasks` with in-flight moves applied.
  func apply(_ tasks: [TaskItem]) -> [TaskItem] {
    tasks.map { task in
      guard let move = pending[task.id] else { return task }
      var moved = task
      moved.status = move.status
      if let position = move.position { moved.position = position }
      return moved
    }
  }

  /// Drops moves the live query now reflects. Call when the tasks change.
  func reconcile(_ tasks: [TaskItem]) {
    for task in tasks {
      guard let move = pending[task.id], task.status == move.status,
        move.position == nil || task.position == move.position
      else { continue }
      pending[task.id] = nil
    }
  }

  func move(
    _ task: TaskItem, to status: TaskStatus, position: Double? = nil, confirmed: Bool = false,
    on client: NeramClient
  ) async {
    let move = Pending(status: status, position: position)
    pending[task.id] = move
    do {
      try await client.run(
        Calls.moveTask(
          task.id, to: status, position: position, confirmIncompleteSubtasks: confirmed))
    } catch {
      pending[task.id] = nil
      if case .server(let payload) = error, payload.code == "INCOMPLETE_SUBTASKS" {
        incomplete = IncompleteMove(
          task: task, position: position, unfinished: Int(payload.unfinishedCount ?? 0))
      } else {
        action.error = error
      }
      return
    }
    // reconcile(_:) normally clears this as soon as the subscription catches
    // up; stop overriding regardless if someone else moved the task again.
    try? await Task.sleep(for: .seconds(5))
    if pending[task.id]?.id == move.id { pending[task.id] = nil }
  }
}

extension View {
  /// The confirmation the web shows as "N subtasks still open".
  func incompleteSubtasksDialog(_ moves: TaskMoves, client: NeramClient) -> some View {
    confirmationDialog(
      moves.incomplete.map {
        "\($0.unfinished) subtask\($0.unfinished == 1 ? "" : "s") still open"
      } ?? "",
      isPresented: Binding(
        get: { moves.incomplete != nil }, set: { if !$0 { moves.incomplete = nil } }),
      titleVisibility: .visible,
      presenting: moves.incomplete
    ) { move in
      Button("Move Anyway") {
        Task {
          await moves.move(
            move.task, to: .done, position: move.position, confirmed: true, on: client)
        }
      }
    } message: { _ in
      Text("Marking a task Done normally requires all of its subtasks to be finished.")
    }
    .actionAlert(moves.action, title: "Couldn't move that task")
  }
}
