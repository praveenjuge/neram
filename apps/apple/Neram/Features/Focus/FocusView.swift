import NeramKit
import SwiftUI

struct FocusView: View {
  @Environment(AppSession.self) private var session
  @State private var current = LiveQuery(Queries.currentSprint)

  var body: some View {
    LiveContent(live: current) { current in
      if let current {
        List {
          if let goal = current.sprint.goal {
            Section("Goal") { Text(goal) }
          }
          Section("Focused tasks") {
            ForEach(current.tasks) { task in
              Label(
                task.title,
                systemImage: task.status == .done ? "checkmark.circle.fill" : "circle")
            }
          }
        }
      } else {
        ContentUnavailableView(
          "No Sprint running", systemImage: "scope",
          description: Text("Sprints are optional. Start one when you want a shared focus list."))
      }
    }
    .navigationTitle("Focus")
    .toolbar { AccountToolbar() }
    .task { await current.run(on: session.client) }
  }
}
