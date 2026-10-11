import Foundation
import Testing

@testable import NeramKit

struct CallTests {
  @Test func numbersAreSentAsFloat64() throws {
    // ConvexMobile would send a Swift Int as int64, which v.number() rejects.
    let request = PageRequest(numItems: 20)
    guard case let .object(fields) = request.arg, case let .number(count)? = fields["numItems"]
    else {
      Issue.record("numItems must be a number")
      return
    }
    #expect(count == 20)
    let encoded = try #require(request.arg.encodable).convexEncode()
    #expect(!encoded.contains("$integer"))
  }

  @Test func queryKeysAreStable() {
    let first = Queries.comments(taskId: "t1", PageRequest(numItems: 10, cursor: "c"))
    let second = Queries.comments(taskId: "t1", PageRequest(numItems: 10, cursor: "c"))
    #expect(first.key == second.key)
    #expect(first.key != Queries.comments(taskId: "t2", PageRequest(numItems: 10)).key)
  }

  @Test func unsetOptionalArgumentsAreOmitted() {
    let call = Calls.updateTask("t1", title: "New", expectedTitle: "Old")
    #expect(Set(call.args.keys) == ["taskId", "title", "expectedTitle"])
    let clearDescription = Calls.updateTask(
      "t1", description: "", expectedDescription: .some(nil))
    #expect(clearDescription.args["expectedDescription"] == .null)
  }

  @Test func sprintDurationRoundTrips() throws {
    for duration in SprintDuration.allCases {
      let data = try JSONEncoder().encode(duration)
      #expect(try JSONDecoder().decode(SprintDuration.self, from: data) == duration)
    }
  }
}
