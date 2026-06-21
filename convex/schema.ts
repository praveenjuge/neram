import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export const status = v.union(
  v.literal("todo"),
  v.literal("inProgress"),
  v.literal("done")
)

export default defineSchema({
  projects: defineTable({
    // Stores the authenticated owner's canonical identity (identity.tokenIdentifier).
    ownerSubject: v.string(),
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
    dueDate: v.optional(v.string()),
    status,
    // Fractional sort key for ordering within a column. New tasks append at the
    // end; drag-to-reorder writes a value between its neighbors.
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner_project_position", [
    "ownerSubject",
    "projectId",
    "position",
  ]),
})
