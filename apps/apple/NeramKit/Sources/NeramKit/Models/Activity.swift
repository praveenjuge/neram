import Foundation

/// One row of `activity:list`. `type` stays a string so new server event types
/// still decode; ``action`` falls back to a generic phrase for unknown ones.
public struct ActivityItem: Codable, Sendable, Hashable, Identifiable {
  public var id: DocumentID
  public var type: String
  public var actorUserId: String
  public var actorName: String
  public var recipientUserId: String?
  public var projectId: DocumentID?
  public var projectName: String?
  public var sprintId: DocumentID?
  public var sprintNumber: Double?
  public var taskId: DocumentID?
  public var taskTitle: String?
  public var commentId: DocumentID?
  public var commentExcerpt: String?
  public var toStatus: TaskStatus?
  public var assigneeName: String?
  public var createdAt: Double

  public var createdDate: Date { Date(convexMilliseconds: createdAt) }

  enum CodingKeys: String, CodingKey {
    case id = "_id"
    case type, actorUserId, actorName, recipientUserId, projectId, projectName
    case sprintId, sprintNumber, taskId, taskTitle, commentId, commentExcerpt
    case toStatus, assigneeName, createdAt
  }

  /// A short past-tense phrase for what the actor did. Mirrors `describe` in
  /// apps/web/src/app/w/[organizationSlug]/(app)/activity/activity-client.tsx.
  public var action: String {
    let task = taskTitle ?? "a task"
    let sprint = sprintNumber.map { " \(Int($0))" } ?? ""
    switch type {
    case "task.created": return "added \(task)"
    case "task.moved": return "moved \(task) to \(toStatus?.label ?? "another column")"
    case "task.assigned": return "assigned \(task) to \(assigneeName ?? "someone")"
    case "task.deleted": return "deleted \(task)"
    case "project.updated": return "updated the project"
    case "member.joined": return "joined"
    case "member.left": return "left"
    case "member.removed": return "was removed"
    case "comment.mentioned": return "mentioned you on \(task)"
    case "comment.replied": return "replied to you on \(task)"
    case "sprint.started": return "started Sprint\(sprint)"
    case "sprint.ended": return "ended Sprint\(sprint)"
    case "sprint.duration_changed": return "updated the default Sprint duration"
    case "sprint.rolled_over": return "rolled over Sprint\(sprint)"
    case "sprint.early_closed": return "closed Sprint\(sprint) early"
    case "sprint.cadence_changed": return "updated the Sprint cadence"
    default: return "made a change"
    }
  }
}
