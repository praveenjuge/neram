import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { internalMutation, mutation, query } from "./_generated/server"
import {
  actor,
  projectCounts,
  recordActivity,
  requireProjectAccess,
  requireProjectOwner,
  type ProjectRole,
} from "./model"

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
  role: v.union(v.literal("owner"), v.literal("editor")),
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

function summarize(project: Doc<"projects">, role: ProjectRole) {
  return { ...publicProject(project), ...projectCounts(project), role }
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

/**
 * Load the projects the caller can see: the ones they own plus the ones they've
 * joined as a member. Deduped, sorted by recent activity, and capped so the
 * read stays bounded. Each project is tagged with the caller's role.
 */
async function accessibleProjects(
  ctx: Parameters<typeof requireProjectAccess>[0],
  subject: string
): Promise<Array<{ project: Doc<"projects">; role: ProjectRole }>> {
  const owned = await ctx.db
    .query("projects")
    .withIndex("by_owner_updated", (q) => q.eq("ownerSubject", subject))
    .order("desc")
    .take(MAX_PROJECTS)

  const memberships = await ctx.db
    .query("projectMembers")
    .withIndex("by_member", (q) => q.eq("subject", subject))
    .take(MAX_PROJECTS)

  const byId = new Map<
    string,
    { project: Doc<"projects">; role: ProjectRole }
  >()
  for (const project of owned) {
    byId.set(project._id, { project, role: "owner" })
  }
  for (const membership of memberships) {
    if (byId.has(membership.projectId)) continue
    const project = await ctx.db.get(membership.projectId)
    if (project) byId.set(project._id, { project, role: "editor" })
  }

  return [...byId.values()]
    .sort((a, b) => b.project.updatedAt - a.project.updatedAt)
    .slice(0, MAX_PROJECTS)
}

export const list = query({
  args: {},
  returns: v.array(projectSummary),
  handler: async (ctx) => {
    const { subject } = await actor(ctx)
    const projects = await accessibleProjects(ctx, subject)
    return projects.map(({ project, role }) => summarize(project, role))
  },
})

/**
 * Lightweight project list (id + name only) for the board's project switcher.
 * The switcher does not need the denormalized counts, so reading just names
 * keeps its payload small and avoids re-rendering on every task-count change.
 * Includes shared projects so collaborators see them in the sidebar.
 */
export const names = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("projects"), name: v.string() })),
  handler: async (ctx) => {
    const { subject } = await actor(ctx)
    const projects = await accessibleProjects(ctx, subject)
    return projects.map(({ project }) => ({
      _id: project._id,
      name: project.name,
    }))
  },
})

export const get = query({
  args: { projectId: v.id("projects") },
  returns: v.union(v.null(), projectSummary),
  handler: async (ctx, args) => {
    const { subject } = await actor(ctx)
    const project = await ctx.db.get(args.projectId)
    if (!project) return null
    if (project.ownerSubject === subject) return summarize(project, "owner")
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_member", (q) =>
        q.eq("projectId", args.projectId).eq("subject", subject)
      )
      .unique()
    if (!membership) return null
    return summarize(project, "editor")
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
    const { subject, name } = await actor(ctx)
    const now = Date.now()
    return await ctx.db.insert("projects", {
      ownerSubject: subject,
      ownerName: name,
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
    // Owner or editor may edit the project's name/icon/color.
    const { project, actor: who } = await requireProjectAccess(
      ctx,
      args.projectId
    )
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
    await recordActivity(ctx, {
      // Use the patched name so the feed reflects the new title.
      project: { ...project, ...patch },
      actor: who,
      type: "project.updated",
    })
    return null
  },
})

export const remove = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Only the owner can delete a project.
    await requireProjectOwner(ctx, args.projectId)

    // Remove this project's membership + invite rows inline (bounded, few rows)
    // so it disappears from collaborators' dashboards and the link stops working.
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(MAX_PROJECTS)
    for (const member of members) await ctx.db.delete(member._id)
    const invites = await ctx.db
      .query("projectInvites")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(MAX_PROJECTS)
    for (const invite of invites) await ctx.db.delete(invite._id)

    // Remove the project immediately so it disappears from the dashboard, then
    // delete its tasks in background batches to stay within transaction limits.
    await ctx.db.delete(args.projectId)
    await ctx.scheduler.runAfter(0, internal.projects.purgeTasks, {
      projectId: args.projectId,
    })
    return null
  },
})

const PURGE_BATCH = 100

export const purgeTasks = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("tasks")
      .withIndex("by_project_position", (q) =>
        q.eq("projectId", args.projectId)
      )
      .take(PURGE_BATCH)
    for (const task of batch) await ctx.db.delete(task._id)
    if (batch.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.projects.purgeTasks, args)
    }
    return null
  },
})
