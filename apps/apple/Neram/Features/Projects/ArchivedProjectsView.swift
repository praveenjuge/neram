import NeramKit
import SwiftUI

/// Archived projects (admins only): unarchive or permanently delete.
struct ArchivedProjectsView: View {
  @Environment(AppSession.self) private var session
  @State private var archived = PagedQuery(pageSize: 30) { Queries.archivedProjects($0) }
  @State private var deleting: ProjectSummary?
  @State private var action = Action()

  var body: some View {
    Group {
      if let error = archived.error, archived.items.isEmpty {
        ContentUnavailableView(
          "Couldn't load archived projects", systemImage: "exclamationmark.triangle",
          description: Text(error.localizedDescription))
      } else if archived.status == .loadingFirstPage {
        ProgressView()
      } else if archived.items.isEmpty {
        ContentUnavailableView(
          "No archived projects", systemImage: "archivebox",
          description: Text("Archive a project from its menu to tuck it away here."))
      } else {
        List {
          ForEach(archived.items) { project in
            HStack(spacing: 12) {
              ProjectBadge(icon: project.icon, color: project.color)
              VStack(alignment: .leading, spacing: 2) {
                Text(project.name)
                Text(
                  "\(Int(project.todoCount)) Todo · \(Int(project.inProgressCount)) Doing · \(Int(project.doneCount)) Done"
                )
                .font(.caption)
                .foregroundStyle(.secondary)
              }
            }
            .swipeActions {
              Button("Delete", systemImage: "trash", role: .destructive) { deleting = project }
              Button("Unarchive", systemImage: "tray.and.arrow.up") {
                Task { await unarchive(project) }
              }
              .tint(.accentColor)
            }
            .contextMenu {
              Button("Unarchive", systemImage: "tray.and.arrow.up") {
                Task { await unarchive(project) }
              }
              Button("Delete", systemImage: "trash", role: .destructive) { deleting = project }
            }
          }
          PageFooter(query: archived)
        }
      }
    }
    .navigationTitle("Archived")
    .confirmationDialog(
      "Delete \(deleting?.name ?? "")?",
      isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
      titleVisibility: .visible, presenting: deleting
    ) { project in
      Button("Delete Project", role: .destructive) {
        Task {
          await action.run { () async throws(NeramError) in
            try await session.client.run(Calls.removeProject(project.id))
          }
        }
      }
    } message: { _ in
      Text("This permanently deletes the project and all of its tasks. This can't be undone.")
    }
    .actionAlert(action)
    .task { await archived.run(on: session.client) }
  }

  private func unarchive(_ project: ProjectSummary) async {
    await action.run { () async throws(NeramError) in
      try await session.client.run(Calls.unarchiveProject(project.id))
    }
  }
}
