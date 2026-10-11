import Foundation

/// `projects:list`, `projects:get`, and `projects:listArchived` rows.
public struct ProjectSummary: Codable, Sendable, Hashable, Identifiable {
  public var id: DocumentID
  public var name: String
  public var icon: String?
  public var color: String?
  public var createdAt: Double
  public var updatedAt: Double
  public var taskCount: Double
  public var todoCount: Double
  public var inProgressCount: Double
  public var doneCount: Double
  public var role: OrganizationRole

  public var updatedDate: Date { Date(convexMilliseconds: updatedAt) }

  enum CodingKeys: String, CodingKey {
    case id = "_id"
    case name, icon, color, createdAt, updatedAt
    case taskCount, todoCount, inProgressCount, doneCount, role
  }
}

/// `projects:names`: the lightweight list used by pickers.
public struct ProjectName: Codable, Sendable, Hashable, Identifiable {
  public var id: DocumentID
  public var name: String
  public var icon: String?
  public var color: String?
  public var role: OrganizationRole
  public var openCount: Double

  enum CodingKeys: String, CodingKey {
    case id = "_id"
    case name, icon, color, role, openCount
  }
}
