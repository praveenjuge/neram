import Foundation

/// Every Convex query the apps read. Names and arguments mirror
/// packages/convex/convex; result shapes are pinned by packages/convex/fixtures.
public enum Queries {
  public static let currentOrganization = Query<CurrentOrganization>("organizations:current")

  public static func members(_ page: PageRequest) -> Query<Page<Member>> {
    Query("organizations:members", ["paginationOpts": page.arg])
  }

  public static let projects = Query<[ProjectSummary]>("projects:list")
  public static let projectNames = Query<[ProjectName]>("projects:names")

  public static func project(_ projectId: DocumentID) -> Query<ProjectSummary?> {
    Query("projects:get", ["projectId": .string(projectId)])
  }

  public static func archivedProjects(_ page: PageRequest) -> Query<Page<ProjectSummary>> {
    Query("projects:listArchived", ["paginationOpts": page.arg])
  }

  public static func tasks(projectId: DocumentID) -> Query<[TaskItem]> {
    Query("tasks:list", ["projectId": .string(projectId)])
  }

  public static func allTasks(assignedToMe: Bool) -> Query<[TaskItem]> {
    Query("tasks:listAll", ["assignedToMe": .bool(assignedToMe)])
  }

  public static func task(_ taskId: DocumentID) -> Query<TaskItem?> {
    Query("tasks:get", ["taskId": .string(taskId)])
  }

  public static func subtasks(taskId: DocumentID, hideCompleted: Bool = false) -> Query<[Subtask]> {
    Query("subtasks:list", ["taskId": .string(taskId), "hideCompleted": .bool(hideCompleted)])
  }

  public static func comments(
    taskId: DocumentID, parentCommentId: DocumentID? = nil, _ page: PageRequest
  ) -> Query<Page<TaskComment>> {
    var args: [String: Arg] = ["taskId": .string(taskId), "paginationOpts": page.arg]
    args["parentCommentId"] = parentCommentId.arg
    return Query("taskComments:list", args)
  }

  public static func commentAncestry(
    commentId: DocumentID, startCommentId: DocumentID? = nil, limit: Int? = nil
  ) -> Query<CommentAncestry> {
    var args: [String: Arg] = ["commentId": .string(commentId)]
    args["startCommentId"] = startCommentId.arg
    args["limit"] = limit.map { .number(Double($0)) }
    return Query("taskComments:getAncestry", args)
  }

  public static let currentSprint = Query<CurrentSprint?>("sprints:current")
  public static let backlog = Query<[TaskItem]>("sprints:backlog")

  public static func sprintHistory(_ page: PageRequest) -> Query<Page<Sprint>> {
    Query("sprints:history", ["paginationOpts": page.arg])
  }

  public static func activity(_ page: PageRequest) -> Query<Page<ActivityItem>> {
    Query("activity:list", ["paginationOpts": page.arg])
  }
}

/// Invitation result from `organizationActions:invite`.
public struct Invitation: Codable, Sendable, Hashable {
  public var invitationId: String
  public var status: String
}

/// Every Convex mutation and action the apps call.
public enum Calls {
  // Workspace

  /// Projects the active Clerk organization into Convex. Run after sign-in and
  /// after every organization switch, before any query.
  public static let syncCurrentOrganization = Call<NoResult>(
    action: "organizationActions:syncCurrent")

  public static func invite(email: String, role: OrganizationRole = .member) -> Call<Invitation> {
    Call(
      action: "organizationActions:invite",
      ["email": .string(email), "role": .string(role.rawValue)])
  }

  // Projects

  public static func createProject(name: String, icon: String?, color: String?) -> Call<
    DocumentID
  > {
    var args: [String: Arg] = ["name": .string(name)]
    args["icon"] = icon.arg
    args["color"] = color.arg
    return Call(mutation: "projects:create", args)
  }

  public static func updateProject(
    _ projectId: DocumentID, name: String? = nil, icon: String? = nil, color: String? = nil
  ) -> Call<NoResult> {
    var args: [String: Arg] = ["projectId": .string(projectId)]
    args["name"] = name.arg
    args["icon"] = icon.arg
    args["color"] = color.arg
    return Call(mutation: "projects:update", args)
  }

  public static func archiveProject(_ projectId: DocumentID) -> Call<NoResult> {
    Call(mutation: "projects:archive", ["projectId": .string(projectId)])
  }

  public static func unarchiveProject(_ projectId: DocumentID) -> Call<NoResult> {
    Call(mutation: "projects:unarchive", ["projectId": .string(projectId)])
  }

  public static func removeProject(_ projectId: DocumentID) -> Call<NoResult> {
    Call(mutation: "projects:remove", ["projectId": .string(projectId)])
  }

  // Tasks

  public static func createTask(
    projectId: DocumentID, title: String, description: String? = nil, dueDate: String? = nil,
    assigneeSubject: String? = nil
  ) -> Call<DocumentID> {
    var args: [String: Arg] = ["projectId": .string(projectId), "title": .string(title)]
    args["description"] = description.arg
    args["dueDate"] = dueDate.arg
    args["assigneeSubject"] = assigneeSubject.arg
    return Call(mutation: "tasks:create", args)
  }

  /// Fields left `nil` are untouched. Pass the value the user started editing
  /// from as `expected…` so a newer edit by someone else returns
  /// `EDIT_CONFLICT` instead of being overwritten.
  public static func updateTask(
    _ taskId: DocumentID,
    title: String? = nil, expectedTitle: String? = nil,
    description: String? = nil, expectedDescription: String?? = nil,
    dueDate: String? = nil, assigneeSubject: String? = nil
  ) -> Call<NoResult> {
    var args: [String: Arg] = ["taskId": .string(taskId)]
    args["title"] = title.arg
    args["expectedTitle"] = expectedTitle.arg
    args["description"] = description.arg
    if let expectedDescription { args["expectedDescription"] = expectedDescription.arg ?? .null }
    args["dueDate"] = dueDate.arg
    args["assigneeSubject"] = assigneeSubject.arg
    return Call(mutation: "tasks:update", args)
  }

  public static func moveTask(
    _ taskId: DocumentID, to status: TaskStatus, position: Double? = nil,
    confirmIncompleteSubtasks: Bool = false
  ) -> Call<NoResult> {
    var args: [String: Arg] = ["taskId": .string(taskId), "status": .string(status.rawValue)]
    args["position"] = position.map(Arg.number)
    if confirmIncompleteSubtasks { args["confirmIncompleteSubtasks"] = .bool(true) }
    return Call(mutation: "tasks:move", args)
  }

  public static func changeTaskProject(_ taskId: DocumentID, to projectId: DocumentID) -> Call<
    NoResult
  > {
    Call(
      mutation: "tasks:changeProject", ["taskId": .string(taskId), "projectId": .string(projectId)])
  }

  public static func removeTask(_ taskId: DocumentID, confirmCascade: Bool = false) -> Call<
    RemovedTask
  > {
    var args: [String: Arg] = ["taskId": .string(taskId)]
    if confirmCascade { args["confirmCascade"] = .bool(true) }
    return Call(mutation: "tasks:remove", args)
  }

  // Subtasks

  public static func createSubtask(taskId: DocumentID, title: String) -> Call<DocumentID> {
    Call(mutation: "subtasks:create", ["taskId": .string(taskId), "title": .string(title)])
  }

  public static func renameSubtask(_ subtaskId: DocumentID, title: String) -> Call<NoResult> {
    Call(mutation: "subtasks:rename", ["subtaskId": .string(subtaskId), "title": .string(title)])
  }

  public static func setSubtaskCompleted(_ subtaskId: DocumentID, _ completed: Bool) -> Call<
    NoResult
  > {
    Call(
      mutation: "subtasks:setCompleted",
      ["subtaskId": .string(subtaskId), "completed": .bool(completed)])
  }

  public static func removeSubtask(_ subtaskId: DocumentID) -> Call<NoResult> {
    Call(mutation: "subtasks:remove", ["subtaskId": .string(subtaskId)])
  }

  // Comments

  public static func createComment(taskId: DocumentID, body: String, mentions: [Mention]) -> Call<
    DocumentID
  > {
    Call(
      mutation: "taskComments:create",
      ["taskId": .string(taskId), "body": .string(body), "mentions": mentions.arg])
  }

  public static func replyToComment(_ commentId: DocumentID, body: String, mentions: [Mention])
    -> Call<DocumentID>
  {
    Call(
      mutation: "taskComments:reply",
      ["commentId": .string(commentId), "body": .string(body), "mentions": mentions.arg])
  }

  public static func editComment(_ commentId: DocumentID, body: String, mentions: [Mention])
    -> Call<NoResult>
  {
    Call(
      mutation: "taskComments:edit",
      ["commentId": .string(commentId), "body": .string(body), "mentions": mentions.arg])
  }

  public static func removeComment(_ commentId: DocumentID) -> Call<NoResult> {
    Call(mutation: "taskComments:remove", ["commentId": .string(commentId)])
  }

  // Sprints

  public static func startSprint(goal: String? = nil, duration: SprintDuration? = nil) -> Call<
    DocumentID
  > {
    var args: [String: Arg] = [:]
    args["goal"] = goal.arg
    args["duration"] = duration?.arg
    return Call(mutation: "sprints:start", args)
  }

  public static func planSprint(_ taskIds: [DocumentID]) -> Call<NoResult> {
    Call(mutation: "sprints:plan", ["taskIds": .array(taskIds.map(Arg.string))])
  }

  public static func returnToBacklog(_ taskIds: [DocumentID]) -> Call<NoResult> {
    Call(mutation: "sprints:remove", ["taskIds": .array(taskIds.map(Arg.string))])
  }

  /// `nil` clears the goal.
  public static func updateSprintGoal(_ goal: String?) -> Call<NoResult> {
    var args: [String: Arg] = [:]
    args["goal"] = goal.arg
    return Call(mutation: "sprints:updateGoal", args)
  }

  public static func updateSprintDuration(_ duration: SprintDuration) -> Call<NoResult> {
    Call(mutation: "sprints:updateDuration", ["duration": duration.arg])
  }

  public static let endSprint = Call<DocumentID>(mutation: "sprints:end", ["confirm": .bool(true)])
}

extension SprintDuration {
  var arg: Arg {
    switch self {
    case .oneWeek: .number(1)
    case .twoWeeks: .number(2)
    case .fourWeeks: .number(4)
    case .open: .string("open")
    }
  }
}

extension [Mention] {
  var arg: Arg {
    .array(
      map {
        .object([
          "start": .number($0.start), "length": .number($0.length),
          "subject": .string($0.subject), "label": .string($0.label),
        ])
      })
  }
}
