import Foundation
import Testing

@testable import NeramKit

struct TaskOrderingTests {
  static func task(_ id: String, _ position: Double, project: String = "p") throws -> TaskItem {
    let json = """
      {"_id":"\(id)","projectId":"\(project)","title":"\(id)","status":"todo","position":\(position),
      "createdAt":0,"updatedAt":0,"totalSubtasks":0,"completedSubtasks":0,"activeCommentCount":0}
      """
    return try JSONDecoder().decode(TaskItem.self, from: Data(json.utf8))
  }

  @Test func positionsMatchTheWebHelper() throws {
    let column = [try Self.task("a", 10), try Self.task("b", 20), try Self.task("c", 30)]
    // Into the middle: midpoint of the neighbours.
    #expect(TaskOrdering.position(in: column, insertingAt: 1, moving: "x") == 15)
    // To the top and the bottom.
    #expect(TaskOrdering.position(in: column, insertingAt: 0, moving: "x") == 9)
    #expect(TaskOrdering.position(in: column, insertingAt: 3, moving: "x") == 31)
    // Moving "a" below "b" skips "a" itself when counting neighbours.
    #expect(TaskOrdering.position(in: column, insertingAt: 2, moving: "a") == 25)
    // An empty column uses the current time in milliseconds.
    let now = Date(timeIntervalSince1970: 5)
    #expect(TaskOrdering.position(in: [], insertingAt: 0, moving: "x", now: now) == 5000)
  }

  @Test func mixedColumnsOrderWithinTheMovingTasksProject() throws {
    // Visual order: a1, b1, a2. Dropping a3 (project a) between b1 and a2
    // lands between a1 and a2 in project a's own ordering.
    let column = [
      try Self.task("a1", 10, project: "a"), try Self.task("b1", 5, project: "b"),
      try Self.task("a2", 20, project: "a"),
    ]
    let moving = try Self.task("a3", 99, project: "a")
    #expect(TaskOrdering.position(inMixed: column, insertingAt: 2, moving: moving) == 15)
  }

  @Test func dueDatesRoundTripAsCalendarDays() throws {
    let date = try #require(DueDate.date(from: "2026-01-20"))
    #expect(DueDate.string(from: date) == "2026-01-20")
    #expect(DueDate.date(from: "soon") == nil)
    #expect(DueDate.display("not-a-date") == "not-a-date")
  }

  @Test func initialsMatchTheWeb() {
    #expect(initials("Ada Lovelace") == "AL")
    #expect(initials("ada") == "AD")
    #expect(initials("Mary Ann Smith") == "MS")
    #expect(initials("  ") == "?")
  }

  static func sprint(endsAt: Double?) throws -> Sprint {
    let end = endsAt.map { #","endsAt":\#($0)"# } ?? ""
    let json = #"{"_id":"s","number":1,"state":"current","startsAt":0"# + end + "}"
    return try JSONDecoder().decode(Sprint.self, from: Data(json.utf8))
  }

  @Test func sprintRemainingMatchesTheWeb() throws {
    let day: Double = 86_400_000
    let now = Date(timeIntervalSince1970: 0)
    var utc = Calendar(identifier: .gregorian)
    utc.timeZone = TimeZone(identifier: "UTC")!
    #expect(
      try Self.sprint(endsAt: 3 * day).remaining(now: now, calendar: utc) == "3 days remaining")
    #expect(try Self.sprint(endsAt: day / 2).remaining(now: now, calendar: utc) == "Ends today")
    #expect(try Self.sprint(endsAt: nil).remaining(now: now) == "No fixed end date")
  }
}
