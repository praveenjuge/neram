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
  /// The latest title this row sent, until the live subtask shows it.
  @State private var sent: String?
  @State private var renaming = 0
  @FocusState private var focused: Bool

  /// The title as far as this row knows, counting renames still in flight.
  private var known: String { sent ?? subtask.title }

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
        text: Binding(get: { draft ?? known }, set: { draft = $0.prefix(utf16Limit: 200) })
      )
      .strikethrough(subtask.completed, color: .secondary)
      .foregroundStyle(subtask.completed ? .secondary : .primary)
      .focused($focused)
      .onSubmit(commit)
      .onChange(of: focused) { _, isFocused in if !isFocused { commit() } }
      .onChange(of: subtask.title) { _, title in
        if title == sent || renaming == 0 { sent = nil }
      }
    }
  }

  /// Renames compare against the latest title sent, so a quick change back
  /// is saved too. The draft stays until its rename succeeds; after a
  /// failure, leaving the field again retries it.
  private func commit() {
    guard let value = draft?.trimmingCharacters(in: .whitespacesAndNewlines) else { return }
    if value.isEmpty {
      draft = nil
      return
    }
    guard value != known else {
      // Already saved, or in flight: that rename settles the draft, and keeps
      // it if it fails.
      if renaming == 0 { draft = nil }
      return
    }
    sent = value
    renaming += 1
    Task {
      let renamed = await run(Calls.renameSubtask(subtask.id, title: value))
      renaming -= 1
      if renamed {
        if draft?.trimmingCharacters(in: .whitespacesAndNewlines) == value { draft = nil }
      } else if sent == value {
        sent = nil
      }
    }
  }
}
