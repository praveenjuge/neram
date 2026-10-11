import NeramKit
import SwiftUI

/// A project's tasks by status. The full board arrives with the task screens.
struct ProjectView: View {
  let projectId: DocumentID

  @Environment(AppSession.self) private var session
  @State private var project: LiveQuery<ProjectSummary?>
  @State private var tasks: LiveQuery<[TaskItem]>

  init(projectId: DocumentID) {
    self.projectId = projectId
    _project = State(initialValue: LiveQuery(Queries.project(projectId)))
    _tasks = State(initialValue: LiveQuery(Queries.tasks(projectId: projectId)))
  }

  var body: some View {
    LiveContent(live: project) { project in
      if let project {
        LiveContent(live: tasks) { tasks in
          List {
            ForEach(TaskStatus.allCases) { status in
              let column = tasks.filter { $0.status == status }.sorted { $0.position < $1.position }
              Section("\(status.label) · \(column.count)") {
                if column.isEmpty {
                  Text("Nothing here yet.").foregroundStyle(.secondary)
                }
                ForEach(column) { task in
                  Text(task.title)
                }
              }
            }
          }
        }
        .navigationTitle(project.name)
      } else {
        ContentUnavailableView(
          "Project not found", systemImage: "folder.badge.questionmark",
          description: Text("It may have been removed, or the link is incorrect."))
      }
    }
    .task { await project.run(on: session.client) }
    .task { await tasks.run(on: session.client) }
  }
}
