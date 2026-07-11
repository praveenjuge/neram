import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export const status = v.union(
  v.literal("todo"),
  v.literal("inProgress"),
  v.literal("done")
)

// Kinds of feed entries fanned out to a project's members. Kept here so both
// the schema and the activity helpers share a single source of truth.
export const activityType = v.union(
  v.literal("task.created"),
  v.literal("task.moved"),
  v.literal("task.assigned"),
  v.literal("task.deleted"),
  v.literal("project.updated"),
  v.literal("member.joined"),
  v.literal("member.left"),
  v.literal("member.removed"),
  v.literal("comment.mentioned"),
  v.literal("comment.replied")
)

export const mention = v.object({
  start: v.number(),
  length: v.number(),
  subject: v.string(),
  label: v.string(),
})

export const organizationRole = v.union(
  v.literal("org:admin"),
  v.literal("org:member")
)

export const organizationState = v.union(
  v.literal("active"),
  v.literal("deleting")
)

export const sprintState = v.union(
  v.literal("current"),
  v.literal("upcoming"),
  v.literal("closed")
)

export const sprintEntryOrigin = v.union(
  v.literal("planned"),
  v.literal("carried"),
  v.literal("scope_added"),
  v.literal("reopened")
)

export const organizationActivityType = v.union(
  activityType,
  v.literal("sprint.started"),
  v.literal("sprint.rolled_over"),
  v.literal("sprint.early_closed"),
  v.literal("sprint.cadence_changed")
)

export default defineSchema({
  projects: defineTable({
    // Widening field for the Organization cutover. It becomes required after
    // the production backfill and tenant-boundary verifier complete.
    organizationId: v.optional(v.string()),
    // Stores the authenticated owner's canonical identity (identity.tokenIdentifier).
    ownerSubject: v.string(),
    // Denormalized owner display name, set on create. Old rows fall back to
    // "Owner" in the member list since they predate this field.
    ownerName: v.optional(v.string()),
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // When set, the project is archived: it's hidden from every active list
    // (dashboard + sidebar) and only surfaces on the owner's Archived page,
    // where it can be unarchived or permanently deleted. Absent = active.
    archivedAt: v.optional(v.number()),
    // Denormalized task counters, kept in sync by the task mutations.
    taskCount: v.number(),
    todoCount: v.number(),
    inProgressCount: v.number(),
    doneCount: v.number(),
  })
    .index("by_organization_archived_updated", [
      "organizationId",
      "archivedAt",
      "updatedAt",
    ])
    // Partitions an owner's projects by archived state, then orders each
    // partition by recency. Active projects (archivedAt unset) and archived
    // projects (archivedAt set) each read from their own slice of the index, so
    // neither can crowd the other out of a bounded read, and both stay ordered
    // by updatedAt.
    .index("by_owner_archived_updated", [
      "ownerSubject",
      "archivedAt",
      "updatedAt",
    ]),
  tasks: defineTable({
    // Widening field; required in the narrowed Organization-only schema.
    organizationId: v.optional(v.string()),
    ownerSubject: v.string(),
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    status,
    // The member the task is assigned to, if any. Subject is the canonical
    // identity key; the denormalized name is shown on cards without a lookup.
    assigneeSubject: v.optional(v.string()),
    assigneeName: v.optional(v.string()),
    // Sprint references describe only the task's live planning placement.
    // Closed Sprint truth lives in sprintTaskEntries and is never rewritten.
    currentSprintId: v.optional(v.id("sprints")),
    upcomingSprintId: v.optional(v.id("sprints")),
    completedAt: v.optional(v.number()),
    // Fractional sort key for ordering within a column. New tasks append at the
    // end; drag-to-reorder writes a value between its neighbors.
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization_and_updated_at", ["organizationId", "updatedAt"])
    .index("by_organization_and_current_sprint", [
      "organizationId",
      "currentSprintId",
      "position",
    ])
    .index("by_organization_and_upcoming_sprint", [
      "organizationId",
      "upcomingSprintId",
      "position",
    ])
    .index("by_owner_project_position", [
      "ownerSubject",
      "projectId",
      "position",
    ])
    // Access/order key keyed only off the project, so a collaborator who does
    // not know the owner's subject can still read and order the board.
    .index("by_project_position", ["projectId", "position"]),
  subtasks: defineTable({
    taskId: v.id("tasks"),
    title: v.string(),
    completed: v.boolean(),
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_task_position", ["taskId", "position"]),
  taskComments: defineTable({
    taskId: v.id("tasks"),
    parentCommentId: v.optional(v.id("taskComments")),
    rootCommentId: v.optional(v.id("taskComments")),
    authorSubject: v.string(),
    authorName: v.string(),
    body: v.string(),
    mentions: v.array(mention),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_task_and_parent_and_created", [
      "taskId",
      "parentCommentId",
      "createdAt",
    ])
    .index("by_task_and_created", ["taskId", "createdAt"]),
  taskStats: defineTable({
    taskId: v.id("tasks"),
    projectId: v.id("projects"),
    totalSubtasks: v.number(),
    completedSubtasks: v.number(),
    activeCommentCount: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_project_and_task", ["projectId", "taskId"]),
  // Non-owner collaborators on a project. The owner is never stored here; their
  // membership is implicit via projects.ownerSubject.
  projectMembers: defineTable({
    projectId: v.id("projects"),
    subject: v.string(),
    role: v.literal("editor"),
    displayName: v.string(),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_member", ["subject"])
    .index("by_project_member", ["projectId", "subject"]),
  // One reusable, revocable invite link per project. Revoke = delete the row;
  // regenerate = patch a fresh token (the old link stops resolving).
  projectInvites: defineTable({
    projectId: v.id("projects"),
    token: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_project", ["projectId"]),
  // Per-recipient fan-out feed. One row is written per member for each action,
  // so each user reads only their own rows via by_subject_created.
  activity: defineTable({
    organizationId: v.optional(v.string()),
    subject: v.string(),
    actorSubject: v.string(),
    actorName: v.string(),
    projectId: v.id("projects"),
    projectName: v.string(),
    type: activityType,
    taskTitle: v.optional(v.string()),
    taskId: v.optional(v.id("tasks")),
    commentId: v.optional(v.id("taskComments")),
    commentExcerpt: v.optional(v.string()),
    toStatus: v.optional(status),
    // For task.assigned rows: who the task was assigned to. The feed compares
    // assigneeSubject against the recipient (subject) to say "to you".
    assigneeSubject: v.optional(v.string()),
    assigneeName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_subject_created", ["subject", "createdAt"])
    .index("by_organization_and_created_at", ["organizationId", "createdAt"]),

  // Legacy per-user project recency rows still exist in deployed datasets even
  // though the product no longer reads them. The migration inventories and
  // purges them explicitly rather than leaving an undeclared orphan table.
  projectWorkStates: defineTable({
    organizationId: v.optional(v.string()),
    subject: v.string(),
    projectId: v.id("projects"),
    lastWorkedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_organization", ["organizationId"]),

  organizations: defineTable({
    organizationId: v.string(),
    slug: v.string(),
    name: v.string(),
    state: organizationState,
    createdAt: v.number(),
    updatedAt: v.number(),
    deletingAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_slug", ["slug"])
    .index("by_state", ["state"]),

  // Clerk is authoritative. This projection exists for reactive member lists
  // and transaction-time authorization, including denial of stale sessions.
  organizationMembers: defineTable({
    organizationId: v.string(),
    membershipId: v.string(),
    userId: v.string(),
    role: organizationRole,
    displayName: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_user", ["organizationId", "userId"])
    .index("by_membership_id", ["membershipId"])
    .index("by_user", ["userId"]),

  organizationSettings: defineTable({
    organizationId: v.string(),
    cadenceWeeks: v.number(),
    startWeekday: v.number(),
    timezone: v.string(),
    nextSprintNumber: v.number(),
    currentSprintId: v.optional(v.id("sprints")),
    upcomingSprintId: v.optional(v.id("sprints")),
    rolloverStatus: v.union(v.literal("idle"), v.literal("running")),
    activeRolloverJobId: v.optional(v.id("sprintRolloverJobs")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  sprints: defineTable({
    organizationId: v.string(),
    number: v.number(),
    goal: v.optional(v.string()),
    state: sprintState,
    startsAt: v.number(),
    endsAt: v.number(),
    closedCutoffAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    earlyCloseActorUserId: v.optional(v.string()),
    earlyCloseActorName: v.optional(v.string()),
    earlyCloseReason: v.optional(v.string()),
    baselineCount: v.optional(v.number()),
    completedCount: v.optional(v.number()),
    carriedCount: v.optional(v.number()),
    addedCount: v.optional(v.number()),
    removedCount: v.optional(v.number()),
    reopenedCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization_and_state", ["organizationId", "state"])
    .index("by_organization_and_number", ["organizationId", "number"])
    .index("by_state_and_ends_at", ["state", "endsAt"]),

  // Rows are never deleted or reassigned to another Sprint. Lifecycle fields
  // are filled as work is removed, credited, or carried so closed history stays
  // immutable even when the live task later changes or is deleted.
  sprintTaskEntries: defineTable({
    organizationId: v.string(),
    sprintId: v.id("sprints"),
    taskId: v.id("tasks"),
    projectId: v.id("projects"),
    projectNameSnapshot: v.string(),
    taskTitleSnapshot: v.string(),
    origin: sprintEntryOrigin,
    actorUserId: v.string(),
    actorName: v.string(),
    addedAt: v.number(),
    removedAt: v.optional(v.number()),
    removedByUserId: v.optional(v.string()),
    removedByName: v.optional(v.string()),
    removalReason: v.optional(v.string()),
    creditedCompletionAt: v.optional(v.number()),
    carriedToSprintId: v.optional(v.id("sprints")),
    priorCompletionSprintId: v.optional(v.id("sprints")),
  })
    .index("by_sprint_and_added_at", ["sprintId", "addedAt"])
    .index("by_sprint_and_task", ["sprintId", "taskId"])
    .index("by_organization_and_task", ["organizationId", "taskId"]),

  sprintRolloverJobs: defineTable({
    organizationId: v.string(),
    closingSprintId: v.id("sprints"),
    promotedSprintId: v.id("sprints"),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    phase: v.union(
      v.literal("promote_upcoming"),
      v.literal("close_current"),
      v.literal("finalize")
    ),
    cursor: v.optional(v.string()),
    cutoffAt: v.number(),
    early: v.boolean(),
    actorUserId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    reason: v.optional(v.string()),
    baselineCount: v.number(),
    completedCount: v.number(),
    carriedCount: v.number(),
    addedCount: v.number(),
    removedCount: v.number(),
    reopenedCount: v.number(),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_status", ["status"])
    .index("by_closing_sprint", ["closingSprintId"]),

  organizationActivity: defineTable({
    organizationId: v.string(),
    actorUserId: v.string(),
    actorName: v.string(),
    recipientUserId: v.optional(v.string()),
    type: organizationActivityType,
    projectId: v.optional(v.id("projects")),
    projectName: v.optional(v.string()),
    sprintId: v.optional(v.id("sprints")),
    sprintNumber: v.optional(v.number()),
    taskTitle: v.optional(v.string()),
    taskId: v.optional(v.id("tasks")),
    commentId: v.optional(v.id("taskComments")),
    commentExcerpt: v.optional(v.string()),
    toStatus: v.optional(status),
    assigneeUserId: v.optional(v.string()),
    assigneeName: v.optional(v.string()),
    detail: v.optional(v.string()),
    legacyEventKey: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_organization_and_created_at", ["organizationId", "createdAt"])
    .index("by_legacy_event_key", ["legacyEventKey"]),

  organizationJobs: defineTable({
    organizationId: v.string(),
    kind: v.union(v.literal("member_cleanup"), v.literal("workspace_deletion")),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    phase: v.string(),
    targetUserId: v.optional(v.string()),
    cursor: v.optional(v.string()),
    confirmationSlug: v.optional(v.string()),
    externalDeletion: v.optional(v.boolean()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_status", ["organizationId", "status"]),

  tenancyMigrationRuns: defineTable({
    key: v.string(),
    phase: v.union(
      v.literal("inventoried"),
      v.literal("provisioning"),
      v.literal("provisioned"),
      v.literal("backfilled"),
      v.literal("verified"),
      v.literal("canonical")
    ),
    expectedProjects: v.number(),
    expectedTasks: v.number(),
    expectedActivityRows: v.number(),
    expectedLegacyMembers: v.number(),
    expectedLegacyInvites: v.number(),
    expectedLegacyWorkStates: v.optional(v.number()),
    expectedSubtasks: v.optional(v.number()),
    expectedComments: v.optional(v.number()),
    expectedTaskStats: v.optional(v.number()),
    expectedOrphanProjectMappings: v.optional(v.number()),
    expectedCohorts: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    verifiedAt: v.optional(v.number()),
  }).index("by_key", ["key"]),

  tenancyMigrationCohorts: defineTable({
    cohortKey: v.string(),
    ownerSubject: v.string(),
    ownerUserId: v.string(),
    ownerDisplayName: v.string(),
    ordinalForOwner: v.number(),
    organizationId: v.optional(v.string()),
    organizationSlug: v.optional(v.string()),
    organizationName: v.optional(v.string()),
    provisionedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_cohort_key", ["cohortKey"])
    .index("by_owner_user_id", ["ownerUserId"]),

  tenancyMigrationCohortMembers: defineTable({
    cohortKey: v.string(),
    subject: v.string(),
    userId: v.string(),
    role: organizationRole,
    displayName: v.string(),
    createdAt: v.number(),
  })
    .index("by_cohort_key", ["cohortKey"])
    .index("by_user_id", ["userId"]),

  tenancyProjectMappings: defineTable({
    projectId: v.id("projects"),
    cohortKey: v.string(),
    organizationId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_cohort_key", ["cohortKey"]),
})
