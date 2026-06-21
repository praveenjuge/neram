import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { internalMutation, mutation, query } from "./_generated/server"
import { owner, projectCounts } from "./model"

// Upper bound for how many projects a single dashboard / switcher load reads.
// Keeps the query bounded as the table grows instead of an unbounded collect().
const MAX_PROJECTS = 200

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

function summarize(project: Doc<"projects">) {
  return { ...publicProject(project), ...projectCounts(project) }
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
    const ownerSubject = await owner(ctx)
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner_updated", (q) => q.eq("ownerSubject", ownerSubject))
      .order("desc")
      .take(MAX_PROJECTS)

    return projects.map(summarize)
  },
})

/**
 * Lightweight project list (id + name only) for the board's project switcher.
 * The switcher does not need the denormalized counts, so reading just names
 * keeps its payload small and avoids re-rendering on every task-count change.
 */
export const names = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("projects"), name: v.string() })),
  handler: async (ctx) => {
    const ownerSubject = await owner(ctx)
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner_updated", (q) => q.eq("ownerSubject", ownerSubject))
      .order("desc")
      .take(MAX_PROJECTS)

    return projects.map((project) => ({ _id: project._id, name: project.name }))
  },
})

export const get = query({
  args: { projectId: v.id("projects") },
  returns: v.union(v.null(), projectSummary),
  handler: async (ctx, args) => {
    const ownerSubject = await owner(ctx)
    const project = await ctx.db.get(args.projectId)
    if (!project || project.ownerSubject !== ownerSubject) return null
    return summarize(project)
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
    const ownerSubject = await owner(ctx)
    const now = Date.now()
    return await ctx.db.insert("projects", {
      ownerSubject,
      name: cleanName(args.name),
      icon: args.icon === undefined ? undefined : cleanIcon(args.icon),
      color: args.color === undefined ? undefined : cleanColor(args.color),
      createdAt: now,
      updatedAt: now,
      taskCount: 0,
      todoCount: 0,
      inProgressCount: 0,
      doneCount: 0,
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
    const ownerSubject = await owner(ctx)
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
    const ownerSubject = await owner(ctx)
    const project = await ctx.db.get(args.projectId)
    if (!project || project.ownerSubject !== ownerSubject) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found.",
      })
    }
    // Remove the project immediately so it disappears from the dashboard, then
    // delete its tasks in background batches to stay within transaction limits.
    await ctx.db.delete(args.projectId)
    await ctx.scheduler.runAfter(0, internal.projects.purgeTasks, {
      projectId: args.projectId,
      ownerSubject,
    })
    return null
  },
})

const PURGE_BATCH = 100

export const purgeTasks = internalMutation({
  args: { projectId: v.id("projects"), ownerSubject: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("tasks")
      .withIndex("by_owner_project_position", (q) =>
        q.eq("ownerSubject", args.ownerSubject).eq("projectId", args.projectId)
      )
      .take(PURGE_BATCH)
    for (const task of batch) await ctx.db.delete(task._id)
    if (batch.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.projects.purgeTasks, args)
    }
    return null
  },
})
