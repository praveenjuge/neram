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

extension Sprint {
  /// `MMM d – MMM d, yyyy`, or `Started MMM d, yyyy` with no fixed end.
  /// Mirrors `dateRange` in apps/web/src/components/sprints/shared.tsx.
  public var dateRange: String {
    let start = startDate
    guard let end = endDate else {
      return "Started \(start.formatted(.dateTime.month(.abbreviated).day().year()))"
    }
    return
      "\(start.formatted(.dateTime.month(.abbreviated).day())) – \(end.formatted(.dateTime.month(.abbreviated).day().year()))"
  }

  /// "N days remaining", "Ends today", or "No fixed end date".
  public func remaining(now: Date = .now, calendar: Calendar = .current) -> String {
    guard let end = endDate else { return "No fixed end date" }
    let days = max(
      0,
      calendar.dateComponents(
        [.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: end)
      ).day ?? 0)
    if days == 0 { return "Ends today" }
    return "\(days) day\(days == 1 ? "" : "s") remaining"
  }
}

/// `sprints:current`: the open Sprint and its focused tasks.
public struct CurrentSprint: Codable, Sendable, Hashable {
  public var sprint: Sprint
  public var tasks: [TaskItem]
}
