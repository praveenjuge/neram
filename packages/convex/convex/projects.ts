import { paginationOptsValidator } from "convex/server"
import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { internalMutation, mutation, query } from "./_generated/server"
import {
  projectCounts,
  recordActivity,
  requireOrganization,
  requireProjectAccess,
  requireProjectAdmin,
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
  role: v.union(v.literal("org:admin"), v.literal("org:member")),
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
  return {
    ...publicProject(project),
    ...projectCounts(project),
    role,
  }
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

/** Load active projects for exactly one active Organization. */
export async function accessibleProjects(
  ctx: Parameters<typeof requireProjectAccess>[0]
): Promise<Array<{ project: Doc<"projects">; role: ProjectRole }>> {
  const access = await requireOrganization(ctx)
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_organization_archived_updated", (q) =>
      q
        .eq("organizationId", access.organization.organizationId)
        .eq("archivedAt", undefined)
    )
    .order("desc")
    .take(MAX_PROJECTS)
  return projects.map((project) => ({
    project,
    role: access.membership.role,
  }))
}

export const list = query({
  args: {},
  returns: v.array(projectSummary),
  handler: async (ctx) => {
    const projects = await accessibleProjects(ctx)
    return projects.map(({ project, role }) => summarize(project, role))
  },
})

/**
 * Organization admins can page archived projects newest first.
 */
export const listArchived = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireOrganization(ctx)
    if (access.membership.role !== "org:admin") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Workspace admin access required.",
      })
    }
    const result = await ctx.db
      .query("projects")
      .withIndex("by_organization_archived_updated", (q) =>
        q
          .eq("organizationId", access.organization.organizationId)
          .gt("archivedAt", 0)
      )
      .order("desc")
      .paginate(args.paginationOpts)
    return {
      ...result,
      page: result.page.map((project) => summarize(project, "org:admin")),
    }
  },
})

/**
 * Lightweight project list for the sidebar / board switcher: id, name, the
 * project's icon + color so the nav can render each project's own glyph, the
 * caller's role (so the sidebar can offer the right per-project actions), and a
 * single `openCount` (todo + in-progress) for an at-a-glance badge. It still
 * omits the full count breakdown, so the payload stays small. Every project in
 * the active Organization is available to its members.
 */
export const names = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      name: v.string(),
      icon: v.optional(v.string()),
      color: v.optional(v.string()),
      role: v.union(v.literal("org:admin"), v.literal("org:member")),
      openCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    const projects = await accessibleProjects(ctx)
    return projects.map(({ project, role }) => {
      const counts = projectCounts(project)
      return {
        _id: project._id,
        name: project.name,
        icon: project.icon,
        color: project.color,
        role,
        openCount: counts.todoCount + counts.inProgressCount,
      }
    })
  },
})

export const get = query({
  args: { projectId: v.id("projects") },
  returns: v.union(v.null(), projectSummary),
  handler: async (ctx, args) => {
    const access = await requireOrganization(ctx)
    const project = await ctx.db.get(args.projectId)
    if (
      !project ||
      project.organizationId !== access.organization.organizationId
    )
      return null
    return summarize(project, access.membership.role)
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
    const access = await requireOrganization(ctx)
    const now = Date.now()
    return await ctx.db.insert("projects", {
      organizationId: access.organization.organizationId,
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

/**
 * Archive a project: hide it from every active list (dashboard + sidebar) for
 * every member. The project and tasks are untouched. Admin-only.
 */
export const archive = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectAdmin(ctx, args.projectId)
    if (project.archivedAt !== undefined) return null
    const now = Date.now()
    await ctx.db.patch(args.projectId, { archivedAt: now, updatedAt: now })
    return null
  },
})

/**
 * Unarchive a project, restoring it to the active lists. Admin-only; a no-op if
 * the project isn't archived.
 */
export const unarchive = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectAdmin(ctx, args.projectId)
    if (project.archivedAt === undefined) return null
    // Patching a field to `undefined` removes it, marking the project active.
    await ctx.db.patch(args.projectId, {
      archivedAt: undefined,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const remove = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectAdmin(ctx, args.projectId)

    // Remove the project immediately so it disappears from the dashboard, then
    // delete its tasks in background batches. Batching keeps each transaction
    // bounded and, unlike an inline cap, never silently leaves rows behind for
    // projects with many tasks.
    await ctx.db.delete(args.projectId)
    await ctx.scheduler.runAfter(0, internal.projects.purgeProjectData, {
      projectId: args.projectId,
    })
    return null
  },
})

const PURGE_BATCH = 100

/**
 * Background cleanup for a deleted project's child rows. Deletes one batch of
 * tasks per run, rescheduling itself until they're drained. This keeps cleanup
 * uncapped (no orphaned rows for large projects) while each transaction stays
 * within its document limits.
 */
export const purgeProjectData = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project_position", (q) =>
        q.eq("projectId", args.projectId)
      )
      .take(PURGE_BATCH)
    for (const task of tasks) {
      await ctx.db.delete(task._id)
      await ctx.scheduler.runAfter(0, internal.tasks.purgeTaskData, {
        taskId: task._id,
      })
    }

    if (tasks.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.projects.purgeProjectData, args)
    }
    return null
  },
})
