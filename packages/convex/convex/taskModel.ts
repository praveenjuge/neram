import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { requireProjectAccess, type ProjectAccess } from "./model"
import { status } from "./schema"

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

/** Bump the task and its project's updatedAt in one shared timestamp. */
export async function touchTask(ctx: MutationCtx, task: Doc<"tasks">) {
  const now = Date.now()
  await ctx.db.patch(task._id, { updatedAt: now })
  await ctx.db.patch(task.projectId, { updatedAt: now })
  return now
}

export type TaskCounts = {
  totalSubtasks: number
  completedSubtasks: number
  activeCommentCount: number
}

const ZERO_TASK_COUNTS: TaskCounts = {
  totalSubtasks: 0,
  completedSubtasks: 0,
  activeCommentCount: 0,
}

// Shared public task shape. The base form is the project board payload; adding
// the project's display fields yields the cross-project / sprint payloads.
const taskBase = {
  _id: v.id("tasks"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  title: v.string(),
  description: v.optional(v.string()),
  dueDate: v.optional(v.string()),
  status,
  assigneeSubject: v.optional(v.string()),
  assigneeName: v.optional(v.string()),
  currentSprintId: v.optional(v.id("sprints")),
  completedAt: v.optional(v.number()),
  position: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  totalSubtasks: v.number(),
  completedSubtasks: v.number(),
  activeCommentCount: v.number(),
}

export const taskValidator = v.object(taskBase)

export const taskWithProjectValidator = v.object({
  ...taskBase,
  projectName: v.string(),
  projectIcon: v.optional(v.string()),
  projectColor: v.optional(v.string()),
})

/** The board/list task payload without project display fields. */
export function publicTask(taskDoc: Doc<"tasks">, counts: TaskCounts) {
  return {
    _id: taskDoc._id,
    _creationTime: taskDoc._creationTime,
    projectId: taskDoc.projectId,
    title: taskDoc.title,
    description: taskDoc.description,
    dueDate: taskDoc.dueDate,
    status: taskDoc.status,
    assigneeSubject: taskDoc.assigneeSubject,
    assigneeName: taskDoc.assigneeName,
    currentSprintId: taskDoc.currentSprintId,
    completedAt: taskDoc.completedAt,
    position: taskDoc.position,
    createdAt: taskDoc.createdAt,
    updatedAt: taskDoc.updatedAt,
    ...counts,
  }
}

/** The cross-project payload with the parent project's display fields. */
export async function publicTaskWithProject(
  ctx: QueryCtx | MutationCtx,
  taskDoc: Doc<"tasks">,
  project: Doc<"projects">
) {
  return {
    ...publicTask(taskDoc, taskCounts(await taskStats(ctx, taskDoc._id))),
    projectName: project.name,
    projectIcon: project.icon,
    projectColor: project.color,
  }
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
