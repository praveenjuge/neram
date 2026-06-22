import { ConvexError, v } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import {
  projectCounts,
  recordActivity,
  requireProjectAccess,
  statusCountField,
  type ProjectCounts,
} from "./model"
import { status } from "./schema"

// Upper bound for a single board load. A kanban board renders every card, so we
// don't paginate, but we cap the read so the query stays bounded as data grows.
const MAX_TASKS = 1000

const task = v.object({
  _id: v.id("tasks"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  title: v.string(),
  description: v.optional(v.string()),
  dueDate: v.optional(v.string()),
  status,
  position: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

function publicTask(taskDoc: Doc<"tasks">) {
  return {
    _id: taskDoc._id,
    _creationTime: taskDoc._creationTime,
    projectId: taskDoc.projectId,
    title: taskDoc.title,
    description: taskDoc.description,
    dueDate: taskDoc.dueDate,
    status: taskDoc.status,
    position: taskDoc.position,
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

// Description is free-form and optional. Trim it, drop it when empty, and cap
// the length so a single task can't store an unbounded blob.
function cleanDescription(description?: string) {
  if (description === undefined) return undefined
  const trimmed = description.trim()
  if (trimmed.length === 0) return undefined
  if (trimmed.length > 2000) {
    throw new ConvexError({
      code: "INVALID_DESCRIPTION",
      message: "Use at most 2000 characters.",
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

export const list = query({
  args: { projectId: v.id("projects") },
  returns: v.array(task),
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId)
    // Ordered by position ascending via the index, so each column renders in
    // the right order without a client-side sort. Keyed only off the project so
    // collaborators (who don't know the owner's subject) can read the board.
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project_position", (q) =>
        q.eq("projectId", args.projectId)
      )
      .take(MAX_TASKS)
    return tasks.map(publicTask)
  },
})

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const { project, actor } = await requireProjectAccess(ctx, args.projectId)
    const now = Date.now()
    const title = cleanTitle(args.title)
    const taskId = await ctx.db.insert("tasks", {
      // Keep the owner's subject as a consistent key; it's no longer the access
      // gate (that's the membership check) but stays set for every task.
      ownerSubject: project.ownerSubject,
      projectId: args.projectId,
      title,
      description: cleanDescription(args.description),
      dueDate: cleanDueDate(args.dueDate),
      status: "todo",
      // Append to the end of the board. Timestamp positions are monotonically
      // increasing and leave wide gaps for drag-to-reorder midpoints.
      position: now,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(args.projectId, {
      taskCount: project.taskCount + 1,
      todoCount: project.todoCount + 1,
      updatedAt: now,
    })
    await recordActivity(ctx, {
      project,
      actor,
      type: "task.created",
      taskTitle: title,
    })
    return taskId
  },
})

// Edit a task's editable fields (title, description, due date). Status changes
// go through `move` so the project counters and activity feed stay correct.
export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.taskId)
    if (!current) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
    }
    await requireProjectAccess(ctx, current.projectId)
    const patch: Partial<Doc<"tasks">> = { updatedAt: Date.now() }
    if (args.title !== undefined) patch.title = cleanTitle(args.title)
    if (args.description !== undefined) {
      patch.description = cleanDescription(args.description)
    }
    if (args.dueDate !== undefined) patch.dueDate = cleanDueDate(args.dueDate)
    await ctx.db.patch(args.taskId, patch)
    return null
  },
})

export const move = mutation({
  // `position` is optional: drag-to-reorder passes an explicit value computed
  // from the drop location, while the "Move" menu omits it to append to the end.
  args: { taskId: v.id("tasks"), status, position: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.taskId)
    if (!current) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
    }
    const { project, actor } = await requireProjectAccess(
      ctx,
      current.projectId
    )
    const now = Date.now()
    const position = args.position ?? now
    await ctx.db.patch(args.taskId, {
      status: args.status,
      position,
      updatedAt: now,
    })

    // Only touch the project doc + feed when the status actually changed: pure
    // reorders within a column leave the counts (and the dashboard sort)
    // untouched and shouldn't spam the activity feed.
    if (current.status !== args.status) {
      const from = statusCountField[current.status]
      const to = statusCountField[args.status]
      const patch: Partial<ProjectCounts> & { updatedAt: number } = {
        updatedAt: now,
      }
      patch[from] = Math.max(0, projectCounts(project)[from] - 1)
      patch[to] = projectCounts(project)[to] + 1
      await ctx.db.patch(current.projectId, patch)
      await recordActivity(ctx, {
        project,
        actor,
        type: "task.moved",
        taskTitle: current.title,
        toStatus: args.status,
      })
    }
    return null
  },
})

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.taskId)
    if (!current) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
    }
    const { project, actor } = await requireProjectAccess(
      ctx,
      current.projectId
    )
    const now = Date.now()
    await ctx.db.delete(args.taskId)
    const field = statusCountField[current.status]
    const patch: Partial<ProjectCounts> & { updatedAt: number } = {
      updatedAt: now,
    }
    patch.taskCount = Math.max(0, project.taskCount - 1)
    patch[field] = Math.max(0, projectCounts(project)[field] - 1)
    await ctx.db.patch(current.projectId, patch)
    await recordActivity(ctx, {
      project,
      actor,
      type: "task.deleted",
      taskTitle: current.title,
    })
    return null
  },
})
