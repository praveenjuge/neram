import { ConvexError } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { requireProjectAccess, type ProjectAccess } from "./model"

export type TaskAccess = ProjectAccess & { task: Doc<"tasks"> }

export async function requireTaskAccess(
  ctx: QueryCtx | MutationCtx,
  taskId: Id<"tasks">
): Promise<TaskAccess> {
  const task = await ctx.db.get(taskId)
  if (!task) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
  }
  const access = await requireProjectAccess(ctx, task.projectId)
  return { ...access, task }
}

export type TaskCounts = {
  totalSubtasks: number
  completedSubtasks: number
  activeCommentCount: number
}

export const ZERO_TASK_COUNTS: TaskCounts = {
  totalSubtasks: 0,
  completedSubtasks: 0,
  activeCommentCount: 0,
}

export async function taskStats(
  ctx: QueryCtx | MutationCtx,
  taskId: Id<"tasks">
) {
  return await ctx.db
    .query("taskStats")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .unique()
}

export function taskCounts(stats: Doc<"taskStats"> | null): TaskCounts {
  return stats
    ? {
        totalSubtasks: stats.totalSubtasks,
        completedSubtasks: stats.completedSubtasks,
        activeCommentCount: stats.activeCommentCount,
      }
    : ZERO_TASK_COUNTS
}

export async function patchTaskStats(
  ctx: MutationCtx,
  args: {
    taskId: Id<"tasks">
    projectId: Id<"projects">
    totalSubtasks?: number
    completedSubtasks?: number
    activeCommentCount?: number
  }
) {
  const current = await taskStats(ctx, args.taskId)
  const next = {
    totalSubtasks: Math.max(
      0,
      args.totalSubtasks ?? current?.totalSubtasks ?? 0
    ),
    completedSubtasks: Math.max(
      0,
      args.completedSubtasks ?? current?.completedSubtasks ?? 0
    ),
    activeCommentCount: Math.max(
      0,
      args.activeCommentCount ?? current?.activeCommentCount ?? 0
    ),
  }
  if (current) {
    await ctx.db.patch(current._id, { projectId: args.projectId, ...next })
    return current._id
  }
  return await ctx.db.insert("taskStats", {
    taskId: args.taskId,
    projectId: args.projectId,
    ...next,
  })
}

export function unfinishedSubtasks(counts: TaskCounts) {
  return Math.max(0, counts.totalSubtasks - counts.completedSubtasks)
}
