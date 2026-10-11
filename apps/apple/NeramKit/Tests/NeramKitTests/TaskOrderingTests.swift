import Foundation
import Testing

@testable import NeramKit

struct TaskOrderingTests {
  static func task(_ id: String, _ position: Double) throws -> TaskItem {
    let json = """
      {"_id":"\(id)","projectId":"p","title":"\(id)","status":"todo","position":\(position),
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
}
