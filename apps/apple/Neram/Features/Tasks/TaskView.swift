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
  @State private var titleBase: String?
  @State private var descriptionDraft = ""
  /// The description editing started from; `.some(nil)` means it was empty.
  @State private var descriptionBase: String??
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
    .onChange(of: task.value) { _, value in moves.reconcile(value.flatMap { $0 }.map { [$0] } ?? [])
    }
    .onChange(of: focus) { previous, _ in
      if previous == .title { commitTitle() }
      if previous == .description { commitDescription() }
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
      titleBase == nil ? task.title : titleDraft
    } set: { value in
      if titleBase == nil { titleBase = task.title }
      titleDraft = value.replacingOccurrences(of: "\n", with: " ").prefix(utf16Limit: 120)
    }
  }

  private func descriptionBinding(_ task: TaskItem) -> Binding<String> {
    Binding {
      descriptionBase == nil ? (task.description ?? "") : descriptionDraft
    } set: { value in
      if descriptionBase == nil { descriptionBase = .some(task.description) }
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

  private func commitTitle() {
    guard let base = titleBase else { return }
    titleBase = nil
    let value = titleDraft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !value.isEmpty, value != base else { return }
    Task { await save(.title, value: value, expected: base) }
  }

  private func commitDescription() {
    guard let base = descriptionBase else { return }
    descriptionBase = nil
    guard descriptionDraft != (base ?? "") else { return }
    Task { await save(.description, value: descriptionDraft, expected: base) }
  }

  private func save(_ field: Field, value: String, expected: String?) async {
    let call =
      field == .title
      ? Calls.updateTask(taskId, title: value, expectedTitle: expected ?? "")
      : Calls.updateTask(taskId, description: value, expectedDescription: .some(expected))
    do {
      try await session.client.run(call)
      conflicts[field] = nil
    } catch {
      if case .server(let payload) = error, payload.code == "EDIT_CONFLICT" {
        conflicts[field] = Conflict(field: field, mine: value, latest: payload.latestValue)
      } else {
        restoreDraft(field, value: value, base: expected)
        action.error = error
      }
    }
  }

  /// Puts unsaved text back in the field after a failed save, unless a newer
  /// edit has started. Leaving the field again retries the save.
  private func restoreDraft(_ field: Field, value: String, base: String?) {
    switch field {
    case .title where titleBase == nil:
      titleBase = base ?? ""
      titleDraft = value
    case .description where descriptionBase == nil:
      descriptionBase = .some(base)
      descriptionDraft = value
    default:
      break
    }
  }

  private func keepMine(_ conflict: Conflict) async {
    let latest =
      conflict.field == .description && (conflict.latest ?? "").isEmpty ? nil : conflict.latest
    await save(conflict.field, value: conflict.mine, expected: latest)
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
