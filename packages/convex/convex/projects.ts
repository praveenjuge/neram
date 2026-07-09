import { paginationOptsValidator } from "convex/server"
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

/**
 * Load the projects the caller can see: the ones they own plus the ones they've
 * joined as a member. Deduped and each tagged with the caller's role. Every read
 * is bounded to `MAX_PROJECTS` so the query stays cheap as the workspace grows,
 * and the returned set is ordered by the project's own `updatedAt` (most
 * recently updated first).
 *
 * Ordering is exact within each bounded read: owned projects are read straight
 * off the `by_owner_archived_updated` index in updatedAt order, so the newest
 * owned projects are always included. Shared memberships are read off
 * `by_member` (which has no project-updatedAt key), so if a single caller
 * belongs to more than `MAX_PROJECTS` *shared* projects, the updatedAt ranking
 * of shared projects beyond that bound is best-effort. That cap is far above any real
 * per-user project count here; making it exact would require denormalizing each
 * project's `updatedAt` onto every membership row and fanning writes out to all
 * members on every task/project mutation — a hot-path cost not worth paying for
 * a bound no user reaches.
 */
export async function accessibleProjects(
  ctx: Parameters<typeof requireProjectAccess>[0],
  subject: string
): Promise<Array<{ project: Doc<"projects">; role: ProjectRole }>> {
  // Read only *active* owned projects (archivedAt unset), newest-updated first.
  // Pinning archivedAt to undefined in the index means archived projects live
  // in a different slice entirely, so they can never consume this bounded read
  // and push active projects out of the window.
  const owned = await ctx.db
    .query("projects")
    .withIndex("by_owner_archived_updated", (q) =>
      q.eq("ownerSubject", subject).eq("archivedAt", undefined)
    )
    .order("desc")
    .take(MAX_PROJECTS)

  // Bounded like the owned read. `by_member` has no project-updatedAt key, so
  // the exact updatedAt ranking of shared projects past this cap is best-effort
  // (see the function doc); the cap sits well above any real per-user count.
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

  return (
    [...byId.values()]
      // Archived projects are hidden from every active list; they live only on
      // the owner's Archived page (see `listArchived`).
      .filter((entry) => entry.project.archivedAt === undefined)
      // Most recently updated first, so the freshest projects surface on top.
      .sort((a, b) => b.project.updatedAt - a.project.updatedAt)
      .slice(0, MAX_PROJECTS)
  )
}

export const list = query({
  args: {},
  returns: v.array(projectSummary),
  handler: async (ctx) => {
    const { subject } = await actor(ctx)
    // accessibleProjects already returns most-recently-updated order.
    const projects = await accessibleProjects(ctx, subject)
    return projects.map(({ project, role }) => summarize(project, role))
  },
})

/**
 * The caller's archived projects, newest-archived first. Owner-only: archiving
 * (and deleting) is an owner action, so only the owner's own archived projects
 * are listed here. Paginated so the Archived page can reach every archived
 * project (via "load more") no matter how many there are — the only UI path to
 * unarchive or permanently delete them.
 */
export const listArchived = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { subject } = await actor(ctx)
    // Read only *archived* owned projects off the shared index. The
    // `gt("archivedAt", 0)` lower bound excludes active projects (whose
    // archivedAt is undefined and sorts below any timestamp), so active
    // projects never leak into this list. `order("desc")` yields
    // newest-archived first.
    const result = await ctx.db
      .query("projects")
      .withIndex("by_owner_archived_updated", (q) =>
        q.eq("ownerSubject", subject).gt("archivedAt", 0)
      )
      .order("desc")
      .paginate(args.paginationOpts)
    return {
      ...result,
      page: result.page.map((project) => summarize(project, "owner")),
    }
  },
})

/**
 * Lightweight project list for the sidebar / board switcher: id, name, the
 * project's icon + color so the nav can render each project's own glyph, the
 * caller's role (so the sidebar can offer the right per-project actions), and a
 * single `openCount` (todo + in-progress) for an at-a-glance badge. It still
 * omits the full count breakdown, so the payload stays small. Includes shared
 * projects so collaborators see them in the sidebar.
 */
export const names = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      name: v.string(),
      icon: v.optional(v.string()),
      color: v.optional(v.string()),
      role: v.union(v.literal("owner"), v.literal("editor")),
      openCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    const { subject } = await actor(ctx)
    const projects = await accessibleProjects(ctx, subject)
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
    const { subject } = await actor(ctx)
    const project = await ctx.db.get(args.projectId)
    if (!project) return null
    if (project.ownerSubject === subject) {
      return summarize(project, "owner")
    }
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

/**
 * Archive a project: hide it from every active list (dashboard + sidebar) for
 * the owner and all collaborators. The project and its tasks are untouched, so
 * it can be unarchived later. Owner-only; a no-op if already archived.
 */
export const archive = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwner(ctx, args.projectId)
    if (project.archivedAt !== undefined) return null
    const now = Date.now()
    await ctx.db.patch(args.projectId, { archivedAt: now, updatedAt: now })
    return null
  },
})

/**
 * Unarchive a project, restoring it to the active lists. Owner-only; a no-op if
 * the project isn't archived.
 */
export const unarchive = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwner(ctx, args.projectId)
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
    for (const task of tasks) await ctx.db.delete(task._id)

    if (tasks.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.projects.purgeProjectData, args)
    }
    return null
  },
})
