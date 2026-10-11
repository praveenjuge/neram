import Foundation

/// A task as returned by `tasks:list`, `tasks:get`, `tasks:listAll`, and the
/// Sprint queries. The cross-project queries also carry the parent project's
/// display fields.
public struct TaskItem: Codable, Sendable, Hashable, Identifiable {
  public var id: DocumentID
  public var projectId: DocumentID
  public var title: String
  public var description: String?
  /// Calendar date as `YYYY-MM-DD`.
  public var dueDate: String?
  public var status: TaskStatus
  public var assigneeSubject: String?
  public var assigneeName: String?
  public var currentSprintId: DocumentID?
  public var completedAt: Double?
  public var position: Double
  public var createdAt: Double
  public var updatedAt: Double
  public var totalSubtasks: Double
  public var completedSubtasks: Double
  public var activeCommentCount: Double
  public var projectName: String?
  public var projectIcon: String?
  public var projectColor: String?

  public var createdDate: Date { Date(convexMilliseconds: createdAt) }
  public var updatedDate: Date { Date(convexMilliseconds: updatedAt) }

  enum CodingKeys: String, CodingKey {
    case id = "_id"
    case projectId, title, description, dueDate, status, assigneeSubject, assigneeName
    case currentSprintId, completedAt, position, createdAt, updatedAt
    case totalSubtasks, completedSubtasks, activeCommentCount
    case projectName, projectIcon, projectColor
  }
}

public struct Subtask: Codable, Sendable, Hashable, Identifiable {
  public var id: DocumentID
  public var taskId: DocumentID
  public var title: String
  public var completed: Bool
  public var position: Double

  enum CodingKeys: String, CodingKey {
    case id = "_id"
    case taskId, title, completed, position
  }
}

/// `tasks:remove` result.
public struct RemovedTask: Codable, Sendable, Hashable {
  public var subtaskCount: Double
  public var commentCount: Double
}
