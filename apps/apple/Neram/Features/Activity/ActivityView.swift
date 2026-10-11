import NeramKit
import SwiftUI

/// Workspace history, newest first. Rows about a task open it.
struct ActivityView: View {
  @Environment(AppSession.self) private var session
  @State private var feed = PagedQuery(pageSize: 30) { Queries.activity($0) }

  var body: some View {
    Group {
      if let error = feed.error, feed.items.isEmpty {
        ContentUnavailableView(
          "Couldn't load activity", systemImage: "exclamationmark.triangle",
          description: Text(error.localizedDescription))
      } else if feed.status == .loadingFirstPage {
        ProgressView()
      } else if feed.items.isEmpty {
        ContentUnavailableView(
          "No activity yet", systemImage: "clock",
          description: Text("Actions across this workspace will show up here."))
      } else {
        List {
          ForEach(feed.items) { item in
            if let taskId = item.taskId, item.projectId != nil {
              NavigationLink(value: AppRoute.task(taskId, comment: item.commentId)) {
                ActivityRow(item: item)
              }
            } else {
              ActivityRow(item: item)
            }
          }
          PageFooter(query: feed)
        }
      }
    }
    .navigationTitle("Activity")
    .toolbar { AccountToolbar() }
    .task { await feed.run(on: session.client) }
  }
}

private struct ActivityRow: View {
  let item: ActivityItem

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      Image(systemName: symbol)
        .foregroundStyle(.secondary)
        .frame(width: 20)
      VStack(alignment: .leading, spacing: 3) {
        Text("\(Text(item.actorName).fontWeight(.medium)) \(item.action)")
        if let excerpt = item.commentExcerpt {
          Text("“\(excerpt)”")
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .lineLimit(2)
        }
        Text(
          "\(context) · \(item.createdDate.formatted(.relative(presentation: .named, unitsStyle: .wide)))"
        )
        .font(.caption)
        .foregroundStyle(.secondary)
      }
    }
  }

  private var context: String {
    if let project = item.projectName { return project }
    if let number = item.sprintNumber { return "Sprint \(Int(number))" }
    return "Workspace"
  }

  /// Matches the icon per event type on the web.
  private var symbol: String {
    switch item.type {
    case "task.created": "plus.circle"
    case "task.moved": "arrow.right.circle"
    case "task.assigned": "person.crop.circle.badge.checkmark"
    case "task.deleted": "trash"
    case "project.updated": "pencil"
    case "member.joined": "person.badge.plus"
    case "member.left": "rectangle.portrait.and.arrow.right"
    case "member.removed": "person.badge.minus"
    case "comment.mentioned": "at"
    case "comment.replied": "arrowshape.turn.up.left"
    case "sprint.started": "play"
    case "sprint.ended": "clock.arrow.circlepath"
    case "sprint.rolled_over", "sprint.early_closed": "arrow.counterclockwise"
    default: "calendar.badge.clock"
    }
  }
}
