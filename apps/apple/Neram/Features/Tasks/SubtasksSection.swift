import NeramKit
import SwiftUI

/// Subtasks: check off, rename inline, swipe to delete, add at the bottom.
struct SubtasksSection: View {
  let taskId: DocumentID

  @Environment(AppSession.self) private var session
  @State private var subtasks: LiveQuery<[Subtask]>
  @State private var newTitle = ""
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
        SubtaskRow(subtask: subtask) { call in run(call) }
          .swipeActions {
            Button("Delete", systemImage: "trash", role: .destructive) {
              run(Calls.removeSubtask(subtask.id))
            }
          }
      }
      TextField("Add a subtask", text: $newTitle)
        .onChange(of: newTitle) { _, value in
          if value.count > Self.titleLimit { newTitle = String(value.prefix(Self.titleLimit)) }
        }
        .onSubmit(add)
        .submitLabel(.done)
    }
    .actionAlert(action)
    .task { await subtasks.run(on: session.client) }
  }

  private func add() {
    let title = newTitle.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !title.isEmpty else { return }
    newTitle = ""
    run(Calls.createSubtask(taskId: taskId, title: title))
  }

  private func run<Value>(_ call: Call<Value>) {
    Task {
      await action.run { () async throws(NeramError) in
        _ = try await session.client.run(call)
      }
    }
  }
}

private struct SubtaskRow: View {
  let subtask: Subtask
  let run: (Call<NoResult>) -> Void

  @State private var draft: String?
  @FocusState private var focused: Bool

  var body: some View {
    HStack {
      Button {
        run(Calls.setSubtaskCompleted(subtask.id, !subtask.completed))
      } label: {
        Image(systemName: subtask.completed ? "checkmark.circle.fill" : "circle")
          .foregroundStyle(subtask.completed ? Color.accentColor : .secondary)
      }
      .buttonStyle(.borderless)
      .accessibilityLabel(subtask.completed ? "Mark not done" : "Mark done")
      TextField(
        "Subtask",
        text: Binding(get: { draft ?? subtask.title }, set: { draft = String($0.prefix(200)) })
      )
      .strikethrough(subtask.completed, color: .secondary)
      .foregroundStyle(subtask.completed ? .secondary : .primary)
      .focused($focused)
      .onSubmit(commit)
      .onChange(of: focused) { _, isFocused in if !isFocused { commit() } }
    }
  }

  private func commit() {
    guard let value = draft?.trimmingCharacters(in: .whitespacesAndNewlines) else { return }
    draft = nil
    guard !value.isEmpty, value != subtask.title else { return }
    run(Calls.renameSubtask(subtask.id, title: value))
  }
}
