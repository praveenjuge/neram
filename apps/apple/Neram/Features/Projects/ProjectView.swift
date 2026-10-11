import NeramKit
import SwiftUI

/// A project's board.
struct ProjectView: View {
  let projectId: DocumentID

  @Environment(AppSession.self) private var session
  @State private var project: LiveQuery<ProjectSummary?>
  @State private var tasks: LiveQuery<[TaskItem]>
  @State private var moves = TaskMoves()
  @State private var creating = false
  @State private var editing: ProjectSummary?

  init(projectId: DocumentID) {
    self.projectId = projectId
    _project = State(initialValue: LiveQuery(Queries.project(projectId)))
    _tasks = State(initialValue: LiveQuery(Queries.tasks(projectId: projectId)))
  }

  var body: some View {
    LiveContent(live: project) { project in
      if let project {
        LiveContent(live: tasks) { tasks in
          TaskBoard(tasks: moves.apply(tasks), moves: moves)
        }
        .navigationTitle(project.name)
        .toolbar {
          ToolbarItem(placement: .primaryAction) {
            Menu("Project", systemImage: "ellipsis") {
              Button("Edit Project", systemImage: "pencil") { editing = project }
            }
          }
          ToolbarItem(placement: .primaryAction) {
            Button("New Task", systemImage: "plus") { creating = true }
              .disabled(!session.isConnected)
          }
        }
      } else {
        ContentUnavailableView(
          "Project not found", systemImage: "folder.badge.questionmark",
          description: Text("It may have been removed, or the link is incorrect."))
      }
    }
    .sheet(isPresented: $creating) {
      NewTaskView(projectId: projectId)
    }
    .sheet(item: $editing) { project in
      ProjectEditor(mode: .edit(project))
    }
    .incompleteSubtasksDialog(moves, client: session.client)
    .onChange(of: tasks.value) { _, value in moves.reconcile(value ?? []) }
    .task { await project.run(on: session.client) }
    .task { await tasks.run(on: session.client) }
  }
}
