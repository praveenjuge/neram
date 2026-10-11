import NeramKit
import SwiftUI

/// The dashboard: every active project, newest activity first.
struct HomeView: View {
  @Environment(AppSession.self) private var session
  @State private var projects = LiveQuery(Queries.projects)
  @State private var workspace = LiveQuery(Queries.currentOrganization)
  @State private var editing: ProjectSummary?
  @State private var creating = false
  @State private var inviting = false
  @State private var archiving: ProjectSummary?
  @Binding var path: [AppRoute]
  @State private var action = Action()

  private var isAdmin: Bool { workspace.value?.isAdmin == true }

  var body: some View {
    NavigationStack(path: $path) {
      LiveContent(live: projects) { projects in
        if projects.isEmpty {
          ContentUnavailableView {
            Label("No projects yet", systemImage: "folder")
          } description: {
            Text("Create your first project to open a kanban board.")
          } actions: {
            Button("New Project") { creating = true }
              .buttonStyle(.borderedProminent)
              .disabled(!session.isConnected)
          }
        } else {
          List(projects) { project in
            NavigationLink(value: AppRoute.project(project.id)) {
              ProjectRow(project: project)
            }
            .swipeActions {
              Button("Edit", systemImage: "pencil") { editing = project }
            }
            .contextMenu { menu(for: project) }
          }
        }
      }
      .navigationTitle("Projects")
      .appDestinations()
      .toolbar {
        AccountToolbar()
        ToolbarItem(placement: .primaryAction) {
          Menu("Add", systemImage: "plus") {
            Button("New Project", systemImage: "folder.badge.plus") { creating = true }
            if isAdmin {
              Button("Share Projects", systemImage: "person.badge.plus") { inviting = true }
            }
            if isAdmin {
              Divider()
              Button("Archived Projects", systemImage: "archivebox") { path.append(.archived) }
            }
          }
          .disabled(!session.isConnected)
        }
      }
      .sheet(isPresented: $creating) {
        ProjectEditor(mode: .create) { id in path.append(.project(id)) }
      }
      .sheet(item: $editing) { project in
        ProjectEditor(mode: .edit(project))
      }
      .sheet(isPresented: $inviting) {
        InviteView()
      }
      .confirmationDialog(
        "Archive \(archiving?.name ?? "")?",
        isPresented: Binding(get: { archiving != nil }, set: { if !$0 { archiving = nil } }),
        titleVisibility: .visible, presenting: archiving
      ) { project in
        Button("Archive", role: .destructive) {
          Task {
            await action.run { () async throws(NeramError) in
              try await session.client.run(Calls.archiveProject(project.id))
            }
          }
        }
      } message: { _ in
        Text(
          "This hides the project and its tasks from your dashboard. You can unarchive or permanently delete it later from Archived."
        )
      }
      .actionAlert(action)
      .task { await projects.run(on: session.client) }
      .task { await workspace.run(on: session.client) }
    }
  }

  @ViewBuilder private func menu(for project: ProjectSummary) -> some View {
    Button("Edit", systemImage: "pencil") { editing = project }
    if project.role == .admin {
      Button("Archive", systemImage: "archivebox", role: .destructive) { archiving = project }
    }
  }
}

private struct ProjectRow: View {
  let project: ProjectSummary

  var body: some View {
    HStack(spacing: 12) {
      ProjectBadge(icon: project.icon, color: project.color)
      VStack(alignment: .leading, spacing: 2) {
        Text(project.name)
        Text("\(Int(project.todoCount)) Todo · \(Int(project.inProgressCount)) Doing")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
  }
}
