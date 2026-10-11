import ClerkKit
import NeramKit
import SwiftUI

/// A task's details. Title and description save on submit or when focus
/// leaves; a newer edit by someone else surfaces as a conflict to resolve,
/// like the web's task dialog.
struct TaskView: View {
  let taskId: DocumentID

  @Environment(AppSession.self) private var session
  @Environment(Clerk.self) private var clerk
  @Environment(\.dismiss) private var dismiss
  @State private var task: LiveQuery<TaskItem?>
  @State private var projects = LiveQuery(Queries.projectNames)
  @State private var members = Members()
  @State private var moves = TaskMoves()
  @State private var action = Action()
  @State private var titleDraft = ""
  @State private var descriptionDraft = ""
  /// The server value each field's edit expects; set while editing or saving.
  /// An empty description is "".
  @State private var bases: [Field: String] = [:]
  @State private var saving: [Field: Int] = [:]
  /// The last value this view saved per field, used until the live task
  /// shows it, so a quick second edit doesn't conflict with our own save.
  @State private var saved: [Field: String] = [:]
  /// One per field, so saving one field never discards the other's conflict.
  @State private var conflicts: [Field: Conflict] = [:]
  @State private var confirmingDelete = false
  @FocusState private var focus: Field?

  private enum Field: String { case title, description }

  private struct Conflict {
    let field: Field
    let mine: String
    let latest: String?
  }

  init(taskId: DocumentID) {
    self.taskId = taskId
    _task = State(initialValue: LiveQuery(Queries.task(taskId)))
  }

  var body: some View {
    LiveContent(live: task) { value in
      if let current = value.flatMap({ moves.apply([$0]).first }) {
        form(current)
      } else {
        ContentUnavailableView(
          "Task unavailable", systemImage: "questionmark.square.dashed",
          description: Text(
            "It was deleted, moved somewhere you cannot access, or the link is invalid."))
      }
    }
    .navigationTitle("Task")
    #if os(iOS)
      .navigationBarTitleDisplayMode(.inline)
    #endif
    .incompleteSubtasksDialog(moves, client: session.client)
    .actionAlert(action)
    .onChange(of: task.value) { _, value in
      let current = value.flatMap { $0 }
      moves.reconcile(current.map { [$0] } ?? [])
      if let current { settleSaved(current) }
    }
    .onChange(of: focus) { previous, _ in
      if let previous { commit(previous) }
    }
    .task { await task.run(on: session.client) }
    .task { await projects.run(on: session.client) }
    .task { await members.run(on: session.client) }
  }

  private func form(_ task: TaskItem) -> some View {
    Form {
      ForEach([Field.title, .description], id: \.self) { field in
        if let conflict = conflicts[field] {
          Section {
            Label(
              "The \(field.rawValue) changed elsewhere.", systemImage: "exclamationmark.triangle")
            HStack {
              Button("Use Latest") { conflicts[field] = nil }
              Spacer()
              Button("Keep Mine") { Task { await keepMine(conflict) } }
                .buttonStyle(.borderedProminent)
            }
          }
        }
      }
      Section {
        TextField("Title", text: titleBinding(task), axis: .vertical)
          .font(.title3.weight(.semibold))
          .focused($focus, equals: .title)
          .onSubmit { focus = nil }
        TextField("Add a description", text: descriptionBinding(task), axis: .vertical)
          .lineLimit(2...12)
          .focused($focus, equals: .description)
      }
      Section {
        Picker("Status", selection: statusBinding(task)) {
          ForEach(TaskStatus.allCases) { Text($0.label).tag($0) }
        }
        .pickerStyle(.segmented)
        Picker("Project", selection: projectBinding(task)) {
          ForEach(projects.value ?? []) { project in
            Text(project.name).tag(project.id)
          }
        }
        DueDateField(date: dueDateBinding(task))
        AssigneePicker(
          selection: assigneeBinding(task), members: members.all, currentUserId: clerk.user?.id)
      } footer: {
        Text(
          "Created \(task.createdDate.formatted(date: .abbreviated, time: .omitted)) · Updated \(task.updatedDate.formatted(date: .abbreviated, time: .omitted))"
        )
      }
      SubtasksSection(taskId: task.id)
    }
    .formStyle(.grouped)
    .disabled(!session.isConnected)
    .toolbar {
      ToolbarItem(placement: .primaryAction) {
        Menu("More", systemImage: "ellipsis") {
          Button("Delete Task…", systemImage: "trash", role: .destructive) {
            confirmingDelete = true
          }
        }
      }
      #if os(iOS)
        ToolbarItemGroup(placement: .keyboard) {
          Spacer()
          Button("Done") { focus = nil }
        }
      #endif
    }
    .confirmationDialog(
      "Delete this task, \(Int(task.totalSubtasks)) subtasks, and \(Int(task.activeCommentCount)) active comments?",
      isPresented: $confirmingDelete, titleVisibility: .visible
    ) {
      Button("Delete Task", role: .destructive) { Task { await delete(task) } }
    }
  }

  // MARK: - Bindings

  private func titleBinding(_ task: TaskItem) -> Binding<String> {
    Binding {
      bases[.title] == nil ? known(.title, task) : titleDraft
    } set: { value in
      if bases[.title] == nil { bases[.title] = known(.title, task) }
      titleDraft = value.replacingOccurrences(of: "\n", with: " ").prefix(utf16Limit: 120)
    }
  }

  private func descriptionBinding(_ task: TaskItem) -> Binding<String> {
    Binding {
      bases[.description] == nil ? known(.description, task) : descriptionDraft
    } set: { value in
      if bases[.description] == nil { bases[.description] = known(.description, task) }
      descriptionDraft = value.prefix(utf16Limit: 2000)
    }
  }

  private func statusBinding(_ task: TaskItem) -> Binding<TaskStatus> {
    Binding {
      task.status
    } set: { status in
      Task { await moves.move(task, to: status, on: session.client) }
    }
  }

  private func projectBinding(_ task: TaskItem) -> Binding<DocumentID> {
    Binding {
      task.projectId
    } set: { projectId in
      run(Calls.changeTaskProject(task.id, to: projectId))
    }
  }

  private func dueDateBinding(_ task: TaskItem) -> Binding<Date?> {
    Binding {
      DueDate.date(from: task.dueDate)
    } set: { date in
      run(Calls.updateTask(task.id, dueDate: date.map(DueDate.string(from:)) ?? ""))
    }
  }

  private func assigneeBinding(_ task: TaskItem) -> Binding<String> {
    Binding {
      task.assigneeSubject ?? ""
    } set: { subject in
      run(Calls.updateTask(task.id, assigneeSubject: subject))
    }
  }

  // MARK: - Saving

  /// What the server has for a field, as far as this view knows.
  private func known(_ field: Field, _ task: TaskItem) -> String {
    saved[field] ?? (field == .title ? task.title : task.description ?? "")
  }

  /// The draft as the server will store it: trimmed.
  private func draft(_ field: Field) -> String {
    (field == .title ? titleDraft : descriptionDraft)
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  /// Saves a finished edit. The field keeps showing the draft until the save
  /// settles, and a follow-up edit expects this save's value.
  private func commit(_ field: Field) {
    guard let base = bases[field] else { return }
    let value = draft(field)
    if field == .title, value.isEmpty { titleDraft = base }
    guard value != base, !(field == .title && value.isEmpty) else {
      if saving[field, default: 0] == 0 { bases[field] = nil }
      return
    }
    bases[field] = value
    Task { await save(field, value: value, expected: base) }
  }

  private func save(_ field: Field, value: String, expected: String) async {
    let call =
      field == .title
      ? Calls.updateTask(taskId, title: value, expectedTitle: expected)
      : Calls.updateTask(
        taskId, description: value, expectedDescription: .some(expected.isEmpty ? nil : expected))
    saving[field, default: 0] += 1
    var keepsDraft = false
    do {
      try await session.client.run(call)
      saved[field] = value
      conflicts[field] = nil
    } catch {
      if case .server(let payload) = error, payload.code == "EDIT_CONFLICT" {
        conflicts[field] = Conflict(field: field, mine: value, latest: payload.latestValue)
      } else {
        // Keep the typed text; leaving the field again retries against the
        // value the server still has.
        if bases[field] == value { bases[field] = expected }
        keepsDraft = true
        action.error = error
      }
    }
    saving[field, default: 0] -= 1
    if !keepsDraft, saving[field] == 0, bases[field] == value, draft(field) == value {
      bases[field] = nil
    }
  }

  /// Forgets our saved values once the live task shows them, or once it
  /// changes with nothing of ours in flight.
  private func settleSaved(_ task: TaskItem) {
    for (field, value) in saved {
      let live = field == .title ? task.title : task.description ?? ""
      if live == value || saving[field, default: 0] == 0 { saved[field] = nil }
    }
  }

  private func keepMine(_ conflict: Conflict) async {
    await save(conflict.field, value: conflict.mine, expected: conflict.latest ?? "")
  }

  private func run(_ call: Call<NoResult>) {
    Task {
      await action.run { () async throws(NeramError) in
        try await session.client.run(call)
      }
    }
  }

  private func delete(_ task: TaskItem) async {
    let finished = await action.run { () async throws(NeramError) in
      _ = try await session.client.run(Calls.removeTask(task.id, confirmCascade: true))
    }
    if finished { dismiss() }
  }
}
