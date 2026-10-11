import ClerkKit
import NeramKit
import SwiftUI

/// New task: title plus optional description, due date, and assignee. New
/// tasks start in Todo, as on the web.
struct NewTaskView: View {
  var projectId: DocumentID?

  @Environment(AppSession.self) private var session
  @Environment(Clerk.self) private var clerk
  @Environment(\.dismiss) private var dismiss
  @State private var projects = LiveQuery(Queries.projectNames)
  @State private var members = Members()
  @State private var selectedProject: DocumentID?
  @State private var title = ""
  @State private var description = ""
  @State private var dueDate: Date?
  @State private var assignee = ""
  @State private var showsDetails = false
  @State private var action = Action()

  static let titleLimit = 120
  static let descriptionLimit = 2000

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Task title", text: $title)
            .onChange(of: title) { _, value in
              if value.utf16.count > Self.titleLimit {
                title = value.prefix(utf16Limit: Self.titleLimit)
              }
            }
          Picker("Project", selection: $selectedProject) {
            ForEach(projects.value ?? []) { project in
              Label {
                Text(project.name)
              } icon: {
                Image(systemName: ProjectStyle.icon(project.icon).symbol)
              }
              .tag(Optional(project.id))
            }
          }
        } footer: {
          Text("New tasks start in the Todo column of the chosen project.")
        }
        if showsDetails {
          Section("Description") {
            TextField("Add more detail", text: $description, axis: .vertical)
              .lineLimit(3...8)
              .onChange(of: description) { _, value in
                if value.utf16.count > Self.descriptionLimit {
                  description = value.prefix(utf16Limit: Self.descriptionLimit)
                }
              }
          }
          Section {
            DueDateField(date: $dueDate)
            AssigneePicker(
              selection: $assignee, members: members.all, currentUserId: clerk.user?.id)
          }
        } else {
          Button("Add Details", systemImage: "plus") { showsDetails = true }
        }
      }
      .formStyle(.grouped)
      .navigationTitle("New Task")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Create") { Task { await create() } }
            .disabled(
              trimmedTitle.isEmpty || selectedProject == nil || action.isRunning
                || !session.isConnected)
        }
      }
      .actionAlert(action)
    }
    .task { await projects.run(on: session.client) }
    .task { await members.run(on: session.client) }
    .onChange(of: projects.value) { _, value in
      if selectedProject == nil { selectedProject = projectId ?? value?.first?.id }
    }
  }

  private var trimmedTitle: String { title.trimmingCharacters(in: .whitespacesAndNewlines) }

  private func create() async {
    guard let selectedProject else { return }
    let details = description.trimmingCharacters(in: .whitespacesAndNewlines)
    let finished = await action.run { () async throws(NeramError) in
      try await session.client.run(
        Calls.createTask(
          projectId: selectedProject, title: trimmedTitle,
          description: details.isEmpty ? nil : details,
          dueDate: dueDate.map(DueDate.string(from:)),
          assigneeSubject: assignee.isEmpty ? nil : assignee))
    }
    if finished { dismiss() }
  }
}

/// A due date that can be added, changed, or removed.
struct DueDateField: View {
  @Binding var date: Date?

  var body: some View {
    if let current = date {
      HStack {
        DatePicker(
          "Due Date", selection: Binding(get: { current }, set: { date = $0 }),
          displayedComponents: .date)
        Button("Remove Due Date", systemImage: "xmark.circle.fill") { date = nil }
          .labelStyle(.iconOnly)
          .buttonStyle(.borderless)
          .foregroundStyle(.secondary)
      }
    } else {
      Button("Add Due Date", systemImage: "calendar") { date = .now }
    }
  }
}

/// "Unassigned" plus every member, marking the current user "(you)".
struct AssigneePicker: View {
  @Binding var selection: String
  let members: [Member]
  let currentUserId: String?

  var body: some View {
    Picker("Assignee", selection: $selection) {
      Text("Unassigned").tag("")
      ForEach(members) { member in
        Text(member.userId == currentUserId ? "\(member.displayName) (you)" : member.displayName)
          .tag(member.userId)
      }
    }
  }
}
