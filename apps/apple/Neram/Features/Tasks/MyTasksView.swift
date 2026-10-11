import NeramKit
import SwiftUI

struct MyTasksView: View {
  @Environment(AppSession.self) private var session
  @State private var tasks = LiveQuery(Queries.allTasks(assignedToMe: true))

  var body: some View {
    LiveContent(live: tasks) { tasks in
      if tasks.isEmpty {
        ContentUnavailableView(
          "Nothing assigned to you", systemImage: "checklist",
          description: Text("Tasks assigned to you across projects show up here."))
      } else {
        List(tasks) { task in
          VStack(alignment: .leading) {
            Text(task.title)
            Text("\(task.projectName ?? "") · \(task.status.label)")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
      }
    }
    .navigationTitle("My Tasks")
    .toolbar { AccountToolbar() }
    .task { await tasks.run(on: session.client) }
  }
}
