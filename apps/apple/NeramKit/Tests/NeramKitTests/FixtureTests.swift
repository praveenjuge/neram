import ConvexMobile
import Foundation
import Testing

@testable import NeramKit

/// Decodes the backend's contract fixtures (packages/convex/fixtures, written
/// by packages/convex/convex/contract.test.ts) into the app's models. A failure
/// here means a backend shape changed and the Swift model must follow.
struct FixtureTests {
  static let fixtures = URL(filePath: #filePath)
    .deletingLastPathComponent()  // NeramKitTests
    .deletingLastPathComponent()  // Tests
    .deletingLastPathComponent()  // NeramKit
    .deletingLastPathComponent()  // apple
    .deletingLastPathComponent()  // apps
    .deletingLastPathComponent()  // repository root
    .appending(path: "packages/convex/fixtures")

  static func decode<Value: Codable>(_ type: Value.Type, _ name: String) throws -> Value {
    let data = try Data(contentsOf: fixtures.appending(path: "\(name).json"))
    let value = try JSONDecoder().decode(Value.self, from: data)
    // Every model is also written to the offline cache, so it must round-trip.
    _ = try JSONDecoder().decode(Value.self, from: JSONEncoder().encode(value))
    return value
  }

  @Test func organization() throws {
    let current = try Self.decode(CurrentOrganization.self, "organizations.current")
    #expect(current.organization.slug == "acme")
    #expect(current.isAdmin)
    #expect(current.settings?.sprintDuration == .oneWeek)

    let members = try Self.decode(Page<Member>.self, "organizations.members")
    #expect(members.page.map(\.displayName) == ["Alice", "Bob"])
    #expect(members.isDone)
  }

  @Test func projects() throws {
    let list = try Self.decode([ProjectSummary].self, "projects.list")
    #expect(list.first?.icon == "folder-kanban")
    #expect(list.first?.taskCount == 3)
    #expect(try Self.decode(ProjectSummary?.self, "projects.get")?.name == "Roadmap")
    #expect(try Self.decode([ProjectName].self, "projects.names").first?.openCount == 2)
    let archived = try Self.decode(Page<ProjectSummary>.self, "projects.listArchived")
    #expect(archived.page.first?.icon == nil)
  }

  @Test func tasks() throws {
    let task = try #require(try Self.decode(TaskItem?.self, "tasks.get"))
    #expect(task.status == .todo)
    #expect(task.dueDate == "2026-01-20")
    #expect(task.assigneeName == "Bob")
    #expect(task.completedSubtasks == 1)
    #expect(try Self.decode([TaskItem].self, "tasks.list").count == 3)
    let all = try Self.decode([TaskItem].self, "tasks.listAll")
    #expect(all.allSatisfy { $0.projectName == "Roadmap" })
    let subtasks = try Self.decode([Subtask].self, "subtasks.list")
    #expect(subtasks.map(\.completed) == [true, false])
  }

  @Test func comments() throws {
    let page = try Self.decode(Page<TaskComment>.self, "taskComments.list")
    let comment = try #require(page.page.first)
    #expect(comment.mentions.first?.start == 10)
    let ancestry = try Self.decode(CommentAncestry.self, "taskComments.getAncestry")
    #expect(ancestry.comments.count == 2)
  }

  @Test func sprints() throws {
    let current = try #require(try Self.decode(CurrentSprint?.self, "sprints.current"))
    #expect(current.sprint.state == .current)
    #expect(current.tasks.allSatisfy { $0.projectName != nil })
    _ = try Self.decode([TaskItem].self, "sprints.backlog")
    let history = try Self.decode(Page<Sprint>.self, "sprints.history")
    #expect(history.page.first?.goal == "Ship the cutover")
    #expect(history.page.first?.baselineCount == 2)
  }

  @Test func activity() throws {
    let page = try Self.decode(Page<ActivityItem>.self, "activity.list")
    #expect(!page.page.isEmpty)
    let actions = page.page.map(\.action)
    #expect(actions.contains("started Sprint 2"))
    #expect(actions.contains("moved Pick a name to Done"))
    #expect(!actions.contains("made a change"))
  }

  @Test func errors() throws {
    let conflict = try Self.decode(ServerError.self, "errors.EDIT_CONFLICT")
    #expect(conflict.code == "EDIT_CONFLICT")
    #expect(conflict.latestValue == "Write the launch post")
    #expect(try Self.decode(ServerError.self, "errors.INCOMPLETE_SUBTASKS").unfinishedCount == 1)
    let cascade = try Self.decode(ServerError.self, "errors.CASCADE_CONFIRMATION_REQUIRED")
    #expect(cascade.subtaskCount == 2)

    // ConvexMobile delivers ConvexError data as JSON text.
    let data = try String(
      contentsOf: Self.fixtures.appending(path: "errors.EDIT_CONFLICT.json"), encoding: .utf8)
    let error = NeramError(ClientError.ConvexError(data: data))
    #expect(error.code == "EDIT_CONFLICT")
    #expect(error.errorDescription == conflict.message)
  }
}
