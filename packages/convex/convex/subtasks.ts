import { ConvexError, v } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import { mutation, query, type MutationCtx } from "./_generated/server"
import { patchTaskStats, requireTaskAccess, taskCounts, taskStats } from "./taskModel"

const MAX_SUBTASKS = 1000
const POSITION_GAP = 1024

const subtask = v.object({
  _id: v.id("subtasks"),
  _creationTime: v.number(),
  taskId: v.id("tasks"),
  title: v.string(),
  completed: v.boolean(),
  position: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

function cleanTitle(value: string) {
  const title = value.trim()
  if (title.length < 1 || title.length > 200) {
    throw new ConvexError({
      code: "INVALID_TITLE",
      message: "Use 1 to 200 characters.",
    })
  }
  return title
}

async function touch(
  ctx: MutationCtx,
  task: Doc<"tasks">
) {
  const now = Date.now()
  await ctx.db.patch(task._id, { updatedAt: now })
  await ctx.db.patch(task.projectId, { updatedAt: now })
  return now
}

export const list = query({
  args: { taskId: v.id("tasks"), hideCompleted: v.optional(v.boolean()) },
  returns: v.array(subtask),
  handler: async (ctx, args) => {
    await requireTaskAccess(ctx, args.taskId)
    const rows = await ctx.db
      .query("subtasks")
      .withIndex("by_task_position", (q) => q.eq("taskId", args.taskId))
      .take(MAX_SUBTASKS)
    return args.hideCompleted ? rows.filter((row) => !row.completed) : rows
  },
})

export const create = mutation({
  args: { taskId: v.id("tasks"), title: v.string() },
  returns: v.id("subtasks"),
  handler: async (ctx, args) => {
    const { task } = await requireTaskAccess(ctx, args.taskId)
    const last = await ctx.db
      .query("subtasks")
      .withIndex("by_task_position", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .first()
    const now = await touch(ctx, task)
    const id = await ctx.db.insert("subtasks", {
      taskId: args.taskId,
      title: cleanTitle(args.title),
      completed: false,
      position: (last?.position ?? 0) + POSITION_GAP,
      createdAt: now,
      updatedAt: now,
    })
    const stats = await taskStats(ctx, args.taskId)
    const counts = taskCounts(stats)
    await patchTaskStats(ctx, {
      taskId: args.taskId,
      projectId: task.projectId,
      totalSubtasks: counts.totalSubtasks + 1,
    })
    return id
  },
})

export const rename = mutation({
  args: { subtaskId: v.id("subtasks"), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.subtaskId)
    if (!current) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Subtask not found." })
    }
    const { task } = await requireTaskAccess(ctx, current.taskId)
    const now = await touch(ctx, task)
    await ctx.db.patch(args.subtaskId, {
      title: cleanTitle(args.title),
      updatedAt: now,
    })
    return null
  },
})

export const setCompleted = mutation({
  args: { subtaskId: v.id("subtasks"), completed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.subtaskId)
    if (!current) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Subtask not found." })
    }
    const { task } = await requireTaskAccess(ctx, current.taskId)
    if (current.completed === args.completed) return null
    const now = await touch(ctx, task)
    await ctx.db.patch(args.subtaskId, {
      completed: args.completed,
      updatedAt: now,
    })
    const stats = await taskStats(ctx, current.taskId)
    const counts = taskCounts(stats)
    await patchTaskStats(ctx, {
      taskId: current.taskId,
      projectId: task.projectId,
      completedSubtasks: counts.completedSubtasks + (args.completed ? 1 : -1),
    })
    return null
  },
})

export const reorder = mutation({
  args: {
    subtaskId: v.id("subtasks"),
    beforeSubtaskId: v.optional(v.id("subtasks")),
    afterSubtaskId: v.optional(v.id("subtasks")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (Boolean(args.beforeSubtaskId) === Boolean(args.afterSubtaskId)) {
      throw new ConvexError({
        code: "INVALID_REORDER",
        message: "Choose exactly one before or after subtask.",
      })
    }
    const current = await ctx.db.get(args.subtaskId)
    if (!current) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Subtask not found." })
    }
    const { task } = await requireTaskAccess(ctx, current.taskId)
    const rows = await ctx.db
      .query("subtasks")
      .withIndex("by_task_position", (q) => q.eq("taskId", current.taskId))
      .take(MAX_SUBTASKS)
    const referenceId = args.beforeSubtaskId ?? args.afterSubtaskId
    const referenceIndex = rows.findIndex((row) => row._id === referenceId)
    if (referenceIndex < 0 || referenceId === current._id) {
      throw new ConvexError({
        code: "INVALID_REORDER",
        message: "Choose another subtask on the same task.",
      })
    }
    const withoutCurrent = rows.filter((row) => row._id !== current._id)
    const index = withoutCurrent.findIndex((row) => row._id === referenceId)
    const insertIndex = args.beforeSubtaskId ? index : index + 1
    const previous = withoutCurrent[insertIndex - 1]
    const next = withoutCurrent[insertIndex]
    const position = previous && next
      ? (previous.position + next.position) / 2
      : previous
        ? previous.position + POSITION_GAP
        : next
          ? next.position - POSITION_GAP
          : POSITION_GAP
    const now = await touch(ctx, task)
    await ctx.db.patch(current._id, { position, updatedAt: now })
    return null
  },
})

export const remove = mutation({
  args: { subtaskId: v.id("subtasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.subtaskId)
    if (!current) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Subtask not found." })
    }
    const { task } = await requireTaskAccess(ctx, current.taskId)
    await touch(ctx, task)
    await ctx.db.delete(args.subtaskId)
    const stats = await taskStats(ctx, current.taskId)
    const counts = taskCounts(stats)
    await patchTaskStats(ctx, {
      taskId: current.taskId,
      projectId: task.projectId,
      totalSubtasks: counts.totalSubtasks - 1,
      completedSubtasks: counts.completedSubtasks - (current.completed ? 1 : 0),
    })
    return null
  },
})
