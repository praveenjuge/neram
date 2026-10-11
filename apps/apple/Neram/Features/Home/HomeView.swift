import NeramKit
import SwiftUI

struct HomeView: View {
  @Environment(AppSession.self) private var session
  @State private var projects = LiveQuery(Queries.projects)

  var body: some View {
    LiveContent(live: projects) { projects in
      if projects.isEmpty {
        ContentUnavailableView(
          "No projects yet", systemImage: "folder",
          description: Text("Projects you create or join show up here."))
      } else {
        List(projects) { project in
          LabeledContent(project.name) {
            Text("\(Int(project.taskCount)) tasks")
          }
        }
      }
    }
    .navigationTitle("Home")
    .toolbar { AccountToolbar() }
    .task { await projects.run(on: session.client) }
  }
}
