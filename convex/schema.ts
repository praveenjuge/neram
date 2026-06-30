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
  v.literal("member.removed")
)

export default defineSchema({
  projects: defineTable({
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
    // Denormalized task counters, kept in sync by the task mutations.
    taskCount: v.number(),
    todoCount: v.number(),
    inProgressCount: v.number(),
    doneCount: v.number(),
  }).index("by_owner_updated", ["ownerSubject", "updatedAt"]),
  tasks: defineTable({
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
    // Fractional sort key for ordering within a column. New tasks append at the
    // end; drag-to-reorder writes a value between its neighbors.
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_project_position", [
      "ownerSubject",
      "projectId",
      "position",
    ])
    // Access/order key keyed only off the project, so a collaborator who does
    // not know the owner's subject can still read and order the board.
    .index("by_project_position", ["projectId", "position"]),
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
  // Per-user, per-project "last worked on" signal that powers the private
  // recency radar on the dashboard. Latest-only: each (subject, projectId) pair
  // has at most one row whose lastWorkedAt is overwritten on every check-in.
  // Personal by design — a collaborator's activity never touches another
  // member's row, so each user's dashboard recency is their own.
  projectWorkStates: defineTable({
    subject: v.string(),
    projectId: v.id("projects"),
    lastWorkedAt: v.number(),
  }).index("by_subject_project", ["subject", "projectId"]),
  // Per-recipient fan-out feed. One row is written per member for each action,
  // so each user reads only their own rows via by_subject_created.
  activity: defineTable({
    subject: v.string(),
    actorSubject: v.string(),
    actorName: v.string(),
    projectId: v.id("projects"),
    projectName: v.string(),
    type: activityType,
    taskTitle: v.optional(v.string()),
    toStatus: v.optional(status),
    // For task.assigned rows: who the task was assigned to. The feed compares
    // assigneeSubject against the recipient (subject) to say "to you".
    assigneeSubject: v.optional(v.string()),
    assigneeName: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_subject_created", ["subject", "createdAt"]),
})
