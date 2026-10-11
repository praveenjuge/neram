import Foundation

/// A Convex document ID. IDs are opaque strings on the wire.
public typealias DocumentID = String

public enum OrganizationRole: String, Codable, Sendable, Hashable {
  case admin = "org:admin"
  case member = "org:member"
}

public enum TaskStatus: String, Codable, Sendable, Hashable, CaseIterable, Identifiable {
  case todo
  case inProgress
  case done

  public var id: String { rawValue }

  public var label: String {
    switch self {
    case .todo: "Todo"
    case .inProgress: "In Progress"
    case .done: "Done"
    }
  }
}

/// One page of a Convex paginated query.
public struct Page<Item: Codable & Sendable>: Codable, Sendable {
  public var page: [Item]
  public var isDone: Bool
  public var continueCursor: String
  /// Set when the server recommends or requires splitting this page in two.
  public var splitCursor: String?
  /// `"SplitRecommended"` or `"SplitRequired"` when present.
  public var pageStatus: String?
}

extension Date {
  /// Convex timestamps are milliseconds since the Unix epoch.
  init(convexMilliseconds: Double) {
    self.init(timeIntervalSince1970: convexMilliseconds / 1000)
  }
}
