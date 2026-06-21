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
    // Kept named `ownerSubject` for backwards compatibility with existing documents.
    ownerSubject: v.string(),
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Denormalized task counters, kept in sync by the task mutations. Optional so
    // existing documents validate before the first write/backfill populates them.
    taskCount: v.optional(v.number()),
    todoCount: v.optional(v.number()),
    inProgressCount: v.optional(v.number()),
    doneCount: v.optional(v.number()),
  }).index("by_owner_updated", ["ownerSubject", "updatedAt"]),
  tasks: defineTable({
    ownerSubject: v.string(),
    projectId: v.id("projects"),
    title: v.string(),
    dueDate: v.optional(v.string()),
    status,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner_project", ["ownerSubject", "projectId"]),
})
