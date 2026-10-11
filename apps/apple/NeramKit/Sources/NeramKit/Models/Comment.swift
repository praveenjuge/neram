import Foundation

/// An @mention inside a comment body. `start` and `length` count UTF-16 code
/// units, matching JavaScript string offsets on the server and web.
public struct Mention: Codable, Sendable, Hashable {
  public var start: Double
  public var length: Double
  public var subject: String
  public var label: String

  public init(start: Int, length: Int, subject: String, label: String) {
    self.start = Double(start)
    self.length = Double(length)
    self.subject = subject
    self.label = label
  }
}

public struct TaskComment: Codable, Sendable, Hashable, Identifiable {
  public var id: DocumentID
  public var taskId: DocumentID
  public var parentCommentId: DocumentID?
  public var rootCommentId: DocumentID?
  public var authorSubject: String
  public var authorName: String
  public var body: String
  public var mentions: [Mention]
  public var createdAt: Double
  public var updatedAt: Double
  /// Set when the comment was removed but kept as a tombstone for its replies.
  public var deletedAt: Double?

  public var createdDate: Date { Date(convexMilliseconds: createdAt) }
  public var isDeleted: Bool { deletedAt != nil }
  public var isEdited: Bool { updatedAt > createdAt }

  enum CodingKeys: String, CodingKey {
    case id = "_id"
    case taskId, parentCommentId, rootCommentId, authorSubject, authorName
    case body, mentions, createdAt, updatedAt, deletedAt
  }
}

/// `taskComments:getAncestry`: the chain from a root comment down to a target.
public struct CommentAncestry: Codable, Sendable, Hashable {
  public var taskId: DocumentID
  public var comments: [TaskComment]
  public var nextCommentId: DocumentID?
}
