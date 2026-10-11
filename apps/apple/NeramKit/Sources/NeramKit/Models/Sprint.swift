import Foundation

public struct Sprint: Codable, Sendable, Hashable, Identifiable {
  public enum State: String, Codable, Sendable, Hashable {
    case current
    case closed
  }

  public var id: DocumentID
  public var number: Double
  public var goal: String?
  public var state: State
  public var startsAt: Double
  public var endsAt: Double?
  public var closedAt: Double?
  public var baselineCount: Double?
  public var completedCount: Double?

  public var startDate: Date { Date(convexMilliseconds: startsAt) }
  public var endDate: Date? { endsAt.map(Date.init(convexMilliseconds:)) }

  enum CodingKeys: String, CodingKey {
    case id = "_id"
    case number, goal, state, startsAt, endsAt, closedAt, baselineCount, completedCount
  }
}

/// `sprints:current`: the open Sprint and its focused tasks.
public struct CurrentSprint: Codable, Sendable, Hashable {
  public var sprint: Sprint
  public var tasks: [TaskItem]
}
