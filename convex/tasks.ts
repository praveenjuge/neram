import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import {
  owner,
  projectCounts,
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
    // Ordered by position ascending via the index, so each column renders in
    // the right order without a client-side sort.
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_owner_project_position", (q) =>
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
    const taskId = await ctx.db.insert("tasks", {
      ownerSubject,
      projectId: args.projectId,
      title: cleanTitle(args.title),
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
    return taskId
  },
})

export const move = mutation({
  // `position` is optional: drag-to-reorder passes an explicit value computed
  // from the drop location, while the "Move" menu omits it to append to the end.
  args: { taskId: v.id("tasks"), status, position: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerSubject = await owner(ctx)
    const current = await ctx.db.get(args.taskId)
    if (!current || current.ownerSubject !== ownerSubject) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
    }
    const now = Date.now()
    const position = args.position ?? now
    await ctx.db.patch(args.taskId, {
      status: args.status,
      position,
      updatedAt: now,
    })

    // Only touch the project doc when the status actually changed: pure reorders
    // within a column leave the counts (and the dashboard sort) untouched.
    if (current.status !== args.status) {
      const project = await ctx.db.get(current.projectId)
      if (project) {
        const from = statusCountField[current.status]
        const to = statusCountField[args.status]
        const patch: Partial<ProjectCounts> & { updatedAt: number } = {
          updatedAt: now,
        }
        patch[from] = Math.max(0, projectCounts(project)[from] - 1)
        patch[to] = projectCounts(project)[to] + 1
        await ctx.db.patch(current.projectId, patch)
      }
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
    await ctx.db.delete(args.taskId)
    if (project) {
      const field = statusCountField[current.status]
      const patch: Partial<ProjectCounts> & { updatedAt: number } = {
        updatedAt: now,
      }
      patch.taskCount = Math.max(0, project.taskCount - 1)
      patch[field] = Math.max(0, projectCounts(project)[field] - 1)
      await ctx.db.patch(current.projectId, patch)
    }
    return null
  },
})
