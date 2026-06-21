import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { owner, resolveCounts, statusCountField } from "./model"
import { status } from "./schema"

// Upper bound for a single board load. A kanban board renders every card, so we
// don't paginate, but we cap the read so the query stays bounded as data grows.
const MAX_TASKS = 1000

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

function cleanTitle(title: string) {
  const trimmed = title.trim()
  if (trimmed.length < 1 || trimmed.length > 120) {
    throw new ConvexError({
      code: "INVALID_TITLE",
      message: "Use 1 to 120 characters.",
    })
  }
  return trimmed
}

function cleanDueDate(dueDate?: string) {
  if (!dueDate) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new ConvexError({
      code: "INVALID_DUE_DATE",
      message: "Use a valid due date.",
    })
  }
  return dueDate
}

async function requireProject(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  ownerSubject: string
) {
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
    const ownerSubject = await owner(ctx)
    await requireProject(ctx, args.projectId, ownerSubject)
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_owner_project", (q) =>
        q.eq("ownerSubject", ownerSubject).eq("projectId", args.projectId)
      )
      .take(MAX_TASKS)
    return tasks.map(publicTask)
  },
})

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    dueDate: v.optional(v.string()),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const ownerSubject = await owner(ctx)
    const project = await requireProject(ctx, args.projectId, ownerSubject)
    const now = Date.now()
    // Resolve counts before inserting so legacy projects compute from the
    // pre-insert task set, then bump for the new Todo task.
    const counts = await resolveCounts(ctx, project)
    const taskId = await ctx.db.insert("tasks", {
      ownerSubject,
      projectId: args.projectId,
      title: cleanTitle(args.title),
      dueDate: cleanDueDate(args.dueDate),
      status: "todo",
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(args.projectId, {
      ...counts,
      taskCount: counts.taskCount + 1,
      todoCount: counts.todoCount + 1,
      updatedAt: now,
    })
    return taskId
  },
})

export const move = mutation({
  args: { taskId: v.id("tasks"), status },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerSubject = await owner(ctx)
    const current = await ctx.db.get(args.taskId)
    if (!current || current.ownerSubject !== ownerSubject) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
    }
    if (current.status === args.status) return null
    const now = Date.now()
    const project = await ctx.db.get(current.projectId)
    // Resolve counts before patching the task so the legacy compute path still
    // reflects the old status.
    const counts = project ? await resolveCounts(ctx, project) : null
    await ctx.db.patch(args.taskId, { status: args.status, updatedAt: now })
    if (counts) {
      const from = statusCountField[current.status]
      const to = statusCountField[args.status]
      counts[from] = Math.max(0, counts[from] - 1)
      counts[to] += 1
      await ctx.db.patch(current.projectId, { ...counts, updatedAt: now })
    }
    return null
  },
})

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerSubject = await owner(ctx)
    const current = await ctx.db.get(args.taskId)
    if (!current || current.ownerSubject !== ownerSubject) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
    }
    const now = Date.now()
    const project = await ctx.db.get(current.projectId)
    const counts = project ? await resolveCounts(ctx, project) : null
    await ctx.db.delete(args.taskId)
    if (counts) {
      const field = statusCountField[current.status]
      counts.taskCount = Math.max(0, counts.taskCount - 1)
      counts[field] = Math.max(0, counts[field] - 1)
      await ctx.db.patch(current.projectId, { ...counts, updatedAt: now })
    }
    return null
  },
})
