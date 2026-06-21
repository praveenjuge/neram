import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export const status = v.union(v.literal("todo"), v.literal("inProgress"), v.literal("done"))

export default defineSchema({
  projects: defineTable({
    ownerSubject: v.string(),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner_updated", ["ownerSubject", "updatedAt"]),
  tasks: defineTable({
    ownerSubject: v.string(),
    projectId: v.id("projects"),
    title: v.string(),
    dueDate: v.optional(v.string()),
    status,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_project", ["ownerSubject", "projectId"])
    .index("by_project_status", ["projectId", "status"]),
})
