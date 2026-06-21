import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { status } from "./schema"

const task = v.object({
  _id: v.id("tasks"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  title: v.string(),
  dueDate: v.optional(v.string()),
  status,
  createdAt: v.number(),
  updatedAt: v.number(),
})

function publicTask(taskDoc: Doc<"tasks">) {
  return {
    _id: taskDoc._id,
    _creationTime: taskDoc._creationTime,
    projectId: taskDoc.projectId,
    title: taskDoc.title,
    dueDate: taskDoc.dueDate,
    status: taskDoc.status,
    createdAt: taskDoc.createdAt,
    updatedAt: taskDoc.updatedAt,
  }
}

async function subject(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in required." })
  return identity.subject
}

function cleanTitle(title: string) {
  const trimmed = title.trim()
  if (trimmed.length < 1 || trimmed.length > 120) {
    throw new ConvexError({ code: "INVALID_TITLE", message: "Use 1 to 120 characters." })
  }
  return trimmed
}

function cleanDueDate(dueDate?: string) {
  if (!dueDate) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new ConvexError({ code: "INVALID_DUE_DATE", message: "Use a valid due date." })
  }
  return dueDate
}

async function requireProject(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">, ownerSubject: string) {
  const project = await ctx.db.get(projectId)
  if (!project || project.ownerSubject !== ownerSubject) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Project not found." })
  }
  return project
}

export const list = query({
  args: { projectId: v.id("projects") },
  returns: v.array(task),
  handler: async (ctx, args) => {
    const ownerSubject = await subject(ctx)
    await requireProject(ctx, args.projectId, ownerSubject)
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_owner_project", (q) => q.eq("ownerSubject", ownerSubject).eq("projectId", args.projectId))
      .collect()
    return tasks.map(publicTask)
  },
})

export const create = mutation({
  args: { projectId: v.id("projects"), title: v.string(), dueDate: v.optional(v.string()) },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const ownerSubject = await subject(ctx)
    await requireProject(ctx, args.projectId, ownerSubject)
    const now = Date.now()
    const taskId = await ctx.db.insert("tasks", {
      ownerSubject,
      projectId: args.projectId,
      title: cleanTitle(args.title),
      dueDate: cleanDueDate(args.dueDate),
      status: "todo",
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(args.projectId, { updatedAt: now })
    return taskId
  },
})

export const move = mutation({
  args: { taskId: v.id("tasks"), status },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerSubject = await subject(ctx)
    const current = await ctx.db.get(args.taskId)
    if (!current || current.ownerSubject !== ownerSubject) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
    }
    if (current.status === args.status) return null
    const now = Date.now()
    await ctx.db.patch(args.taskId, { status: args.status, updatedAt: now })
    await ctx.db.patch(current.projectId, { updatedAt: now })
    return null
  },
})
