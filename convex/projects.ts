import { ConvexError, v } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"

const counts = {
  todo: 0,
  inProgress: 0,
  done: 0,
}

const projectSummary = v.object({
  _id: v.id("projects"),
  _creationTime: v.number(),
  name: v.string(),
  icon: v.optional(v.string()),
  color: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  taskCount: v.number(),
  todoCount: v.number(),
  inProgressCount: v.number(),
  doneCount: v.number(),
})

function publicProject(project: Doc<"projects">) {
  return {
    _id: project._id,
    _creationTime: project._creationTime,
    name: project.name,
    icon: project.icon,
    color: project.color,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

async function subject(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity)
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in required.",
    })
  return identity.subject
}

function cleanName(name: string) {
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new ConvexError({
      code: "INVALID_NAME",
      message: "Use 1 to 80 characters.",
    })
  }
  return trimmed
}

function cleanIcon(icon: string) {
  const trimmed = icon.trim()
  if (!/^[a-z0-9-]{1,40}$/.test(trimmed)) {
    throw new ConvexError({
      code: "INVALID_ICON",
      message: "Choose a valid icon.",
    })
  }
  return trimmed
}

function cleanColor(color: string) {
  const trimmed = color.trim()
  if (!/^[a-z0-9-]{1,40}$/.test(trimmed)) {
    throw new ConvexError({
      code: "INVALID_COLOR",
      message: "Choose a valid color.",
    })
  }
  return trimmed
}

export const list = query({
  args: {},
  returns: v.array(projectSummary),
  handler: async (ctx) => {
    const ownerSubject = await subject(ctx)
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner_updated", (q) => q.eq("ownerSubject", ownerSubject))
      .order("desc")
      .collect()

    return await Promise.all(
      projects.map(async (project) => {
        const taskCounts = { ...counts }
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_owner_project", (q) =>
            q.eq("ownerSubject", ownerSubject).eq("projectId", project._id)
          )
          .collect()
        for (const task of tasks) taskCounts[task.status] += 1
        return {
          ...publicProject(project),
          taskCount: tasks.length,
          todoCount: taskCounts.todo,
          inProgressCount: taskCounts.inProgress,
          doneCount: taskCounts.done,
        }
      })
    )
  },
})

export const get = query({
  args: { projectId: v.id("projects") },
  returns: v.union(v.null(), projectSummary),
  handler: async (ctx, args) => {
    const ownerSubject = await subject(ctx)
    const project = await ctx.db.get(args.projectId)
    if (!project || project.ownerSubject !== ownerSubject) return null
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_owner_project", (q) =>
        q.eq("ownerSubject", ownerSubject).eq("projectId", project._id)
      )
      .collect()
    const taskCounts = { ...counts }
    for (const task of tasks) taskCounts[task.status] += 1
    return {
      ...publicProject(project),
      taskCount: tasks.length,
      todoCount: taskCounts.todo,
      inProgressCount: taskCounts.inProgress,
      doneCount: taskCounts.done,
    }
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const ownerSubject = await subject(ctx)
    const now = Date.now()
    return await ctx.db.insert("projects", {
      ownerSubject,
      name: cleanName(args.name),
      icon: args.icon === undefined ? undefined : cleanIcon(args.icon),
      color: args.color === undefined ? undefined : cleanColor(args.color),
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerSubject = await subject(ctx)
    const project = await ctx.db.get(args.projectId)
    if (!project || project.ownerSubject !== ownerSubject) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found.",
      })
    }
    const patch: {
      name?: string
      icon?: string
      color?: string
      updatedAt: number
    } = {
      updatedAt: Date.now(),
    }
    if (args.name !== undefined) patch.name = cleanName(args.name)
    if (args.icon !== undefined) patch.icon = cleanIcon(args.icon)
    if (args.color !== undefined) patch.color = cleanColor(args.color)
    await ctx.db.patch(args.projectId, patch)
    return null
  },
})

export const remove = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerSubject = await subject(ctx)
    const project = await ctx.db.get(args.projectId)
    if (!project || project.ownerSubject !== ownerSubject) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found.",
      })
    }
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_owner_project", (q) =>
        q.eq("ownerSubject", ownerSubject).eq("projectId", args.projectId)
      )
      .collect()
    for (const task of tasks) {
      await ctx.db.delete(task._id)
    }
    await ctx.db.delete(args.projectId)
    return null
  },
})
