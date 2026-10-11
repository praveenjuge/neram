import Foundation

/// Board ordering and display helpers shared by every task list. Each mirrors
/// a web helper so both clients order and label tasks identically.
public enum TaskOrdering {
  /// The `position` for `tasks:move` when dropping `movingId` at `insertIndex`
  /// of `destination` (already sorted by position). Mirrors `positionFor` in
  /// apps/web/src/components/project-board/board-shared.tsx.
  public static func position(
    in destination: [TaskItem], insertingAt insertIndex: Int, moving movingId: DocumentID,
    now: Date = .now
  ) -> Double {
    let list = destination.filter { $0.id != movingId }
    let adjusted = destination.prefix(max(0, insertIndex)).filter { $0.id != movingId }.count
    let before = adjusted > 0 ? list[adjusted - 1] : nil
    let after = adjusted < list.count ? list[adjusted] : nil
    switch (before, after) {
    case (nil, nil): return now.timeIntervalSince1970 * 1000
    case (nil, let after?): return after.position - 1
    case (let before?, nil): return before.position + 1
    case (let before?, let after?): return (before.position + after.position) / 2
    }
  }

  /// Tasks of one status, in board order.
  public static func column(_ tasks: [TaskItem], status: TaskStatus) -> [TaskItem] {
    tasks.filter { $0.status == status }.sorted { $0.position < $1.position }
  }
}

/// Due dates are stored as plain `yyyy-MM-dd` calendar dates.
public enum DueDate {
  private static let calendar = Calendar(identifier: .gregorian)

  public static func date(from value: String?) -> Date? {
    guard let value else { return nil }
    let parts = value.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    var components = DateComponents()
    components.year = parts[0]
    components.month = parts[1]
    components.day = parts[2]
    var local = calendar
    local.timeZone = .current
    return local.date(from: components)
  }

  public static func string(from date: Date) -> String {
    var local = calendar
    local.timeZone = .current
    let parts = local.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }

  /// `MMM d, yyyy`, like the web; unparseable values show as stored.
  public static func display(_ value: String?) -> String {
    guard let value else { return "" }
    guard let date = date(from: value) else { return value }
    return date.formatted(.dateTime.month(.abbreviated).day().year())
  }
}

/// Avatar initials, matching apps/web/src/components/user-avatar.tsx.
public func initials(_ name: String) -> String {
  let parts = name.split(whereSeparator: \.isWhitespace)
  guard let first = parts.first else { return "?" }
  if parts.count == 1 { return String(first.prefix(2)).uppercased() }
  return (String(first.prefix(1)) + String(parts.last!.prefix(1))).uppercased()
}
