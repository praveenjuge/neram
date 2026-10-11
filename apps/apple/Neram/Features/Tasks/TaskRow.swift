import NeramKit
import SwiftUI

extension TaskStatus {
  var symbol: String {
    switch self {
    case .todo: "circle"
    case .inProgress: "circle.dotted.circle"
    case .done: "checkmark.circle.fill"
    }
  }
}

/// One task line: status, title, due date, project (on cross-project lists),
/// subtask and comment counts, and the assignee. Mirrors the web's TaskItem.
struct TaskRow: View {
  let task: TaskItem
  var showsProject = false

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 10) {
      Image(systemName: task.status.symbol)
        .foregroundStyle(task.status == .done ? Color.accentColor : .secondary)
        .accessibilityLabel(task.status.label)
      VStack(alignment: .leading, spacing: 4) {
        Text(task.title)
          .strikethrough(task.status == .done, color: .secondary)
        meta
      }
      Spacer(minLength: 0)
      if let name = task.assigneeName {
        UserAvatar(name: name)
          .accessibilityLabel("Assigned to \(name)")
      }
    }
  }

  @ViewBuilder private var meta: some View {
    let hasMeta =
      task.dueDate != nil || showsProject || task.totalSubtasks > 0 || task.activeCommentCount > 0
    if hasMeta {
      HStack(spacing: 10) {
        if let due = task.dueDate {
          Label(DueDate.display(due), systemImage: "calendar")
        }
        if showsProject, let project = task.projectName {
          Label {
            Text(project)
          } icon: {
            Image(systemName: ProjectStyle.icon(task.projectIcon).symbol)
              .foregroundStyle(Color(ProjectStyle.color(task.projectColor)))
          }
        }
        if task.totalSubtasks > 0 {
          Label(
            "\(Int(task.completedSubtasks))/\(Int(task.totalSubtasks))",
            systemImage: "checklist")
        }
        if task.activeCommentCount > 0 {
          Label("\(Int(task.activeCommentCount))", systemImage: "bubble.left")
        }
      }
      .font(.caption)
      .foregroundStyle(.secondary)
      .labelStyle(.titleAndIcon)
    }
  }
}
