import NeramKit
import SwiftUI

/// Subtasks: check off, rename inline, swipe to delete, add at the bottom.
struct SubtasksSection: View {
  let taskId: DocumentID

  @Environment(AppSession.self) private var session
  @State private var subtasks: LiveQuery<[Subtask]>
  @State private var newTitle = ""
  @State private var adding = false
  @State private var action = Action()

  static let titleLimit = 200

  init(taskId: DocumentID) {
    self.taskId = taskId
    _subtasks = State(initialValue: LiveQuery(Queries.subtasks(taskId: taskId)))
  }

  var body: some View {
    Section("Subtasks") {
      let rows = (subtasks.value ?? []).sorted { $0.position < $1.position }
      if subtasks.value != nil, rows.isEmpty {
        Text("No subtasks yet.").foregroundStyle(.secondary)
      }
      ForEach(rows) { subtask in
        SubtaskRow(subtask: subtask) { call in await run(call) }
          .swipeActions {
            Button("Delete", systemImage: "trash", role: .destructive) {
              Task { await run(Calls.removeSubtask(subtask.id)) }
            }
          }
      }
      TextField("Add a subtask", text: $newTitle)
        .onChange(of: newTitle) { _, value in
          if value.utf16.count > Self.titleLimit {
            newTitle = value.prefix(utf16Limit: Self.titleLimit)
          }
        }
        .onSubmit(add)
        .submitLabel(.done)
    }
    .actionAlert(action)
    .task { await subtasks.run(on: session.client) }
  }

  /// Keeps the typed title until the server accepts it, so a failed add can
  /// be retried without retyping.
  private func add() {
    let title = newTitle.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !title.isEmpty, !adding else { return }
    adding = true
    Task {
      if await run(Calls.createSubtask(taskId: taskId, title: title)),
        newTitle.trimmingCharacters(in: .whitespacesAndNewlines) == title
      {
        newTitle = ""
      }
      adding = false
    }
  }

  @discardableResult
  private func run<Value>(_ call: Call<Value>) async -> Bool {
    await action.run { () async throws(NeramError) in
      _ = try await session.client.run(call)
    }
  }
}

private struct SubtaskRow: View {
  let subtask: Subtask
  let run: (Call<NoResult>) async -> Bool

  @State private var draft: String?
  @FocusState private var focused: Bool

  var body: some View {
    HStack {
      Button {
        Task { await run(Calls.setSubtaskCompleted(subtask.id, !subtask.completed)) }
      } label: {
        Image(systemName: subtask.completed ? "checkmark.circle.fill" : "circle")
          .foregroundStyle(subtask.completed ? Color.accentColor : .secondary)
      }
      .buttonStyle(.borderless)
      .accessibilityLabel(subtask.completed ? "Mark not done" : "Mark done")
      TextField(
        "Subtask",
        text: Binding(get: { draft ?? subtask.title }, set: { draft = $0.prefix(utf16Limit: 200) })
      )
      .strikethrough(subtask.completed, color: .secondary)
      .foregroundStyle(subtask.completed ? .secondary : .primary)
      .focused($focused)
      .onSubmit(commit)
      .onChange(of: focused) { _, isFocused in if !isFocused { commit() } }
    }
  }

  /// The draft stays until the rename succeeds; after a failure, leaving the
  /// field again retries it.
  private func commit() {
    guard let value = draft?.trimmingCharacters(in: .whitespacesAndNewlines) else { return }
    guard !value.isEmpty, value != subtask.title else {
      draft = nil
      return
    }
    Task {
      if await run(Calls.renameSubtask(subtask.id, title: value)),
        draft?.trimmingCharacters(in: .whitespacesAndNewlines) == value
      {
        draft = nil
      }
    }
  }
}
