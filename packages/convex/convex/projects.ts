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
  touchProjectWorkState,
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
  // The caller's own "last worked on" timestamp for this project, or undefined
  // if they've never checked in. Personal to the caller; never an owner field.
  lastWorkedAt: v.optional(v.number()),
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

function summarize(
  project: Doc<"projects">,
  role: ProjectRole,
  lastWorkedAt?: number
) {
  return {
    ...publicProject(project),
    ...projectCounts(project),
    role,
    lastWorkedAt,
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
 * joined as a member. Deduped, capped so the read stays bounded, and ordered by
 * the caller's personal recency (most recently worked first) so the bounded
 * window keeps the projects they actually touched rather than dropping a freshly
 * checked-in one. Each project is tagged with the caller's role and their
 * personal `lastWorkedAt` (undefined if they've never checked in).
 */
export async function accessibleProjects(
  ctx: Parameters<typeof requireProjectAccess>[0],
  subject: string
): Promise<
  Array<{ project: Doc<"projects">; role: ProjectRole; lastWorkedAt?: number }>
> {
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

  // The caller's personal work states, keyed by project. A single indexed read
  // off `by_subject_project` (subject prefix) returns every check-in they own.
  // Collected in full (not take-capped): the rows are scoped to one subject and
  // bounded by the projects they can access — and deleting a project purges its
  // rows — so a take cap here would instead silently drop recency for some
  // projects (the index orders by projectId, not by how recently worked).
  const workStates = await ctx.db
    .query("projectWorkStates")
    .withIndex("by_subject_project", (q) => q.eq("subject", subject))
    .collect()
  const lastWorkedByProject = new Map<string, number>()
  for (const state of workStates) {
    lastWorkedByProject.set(state.projectId, state.lastWorkedAt)
  }

  return (
    [...byId.values()]
      // Archived projects are hidden from every active list; they live only on
      // the owner's Archived page (see `listArchived`).
      .filter((entry) => entry.project.archivedAt === undefined)
      .map((entry) => ({
        ...entry,
        lastWorkedAt: lastWorkedByProject.get(entry.project._id),
      }))
      // Sort by personal recency *before* slicing so a project the caller just
      // checked in on (which does not bump project.updatedAt) is never dropped
      // from the bounded window in favor of a more-recently-edited one.
      .sort(byPersonalRecency)
      .slice(0, MAX_PROJECTS)
  )
}

/**
 * Order projects by the caller's personal recency: most recently worked first,
 * tie-broken by the project's own `updatedAt`. Projects the caller has never
 * checked in on sort last, regardless of how recently they changed.
 */
function byPersonalRecency(
  a: { project: Doc<"projects">; lastWorkedAt?: number },
  b: { project: Doc<"projects">; lastWorkedAt?: number }
): number {
  if (a.lastWorkedAt !== undefined && b.lastWorkedAt !== undefined) {
    if (b.lastWorkedAt !== a.lastWorkedAt)
      return b.lastWorkedAt - a.lastWorkedAt
    return b.project.updatedAt - a.project.updatedAt
  }
  if (a.lastWorkedAt !== undefined) return -1
  if (b.lastWorkedAt !== undefined) return 1
  return b.project.updatedAt - a.project.updatedAt
}

export const list = query({
  args: {},
  returns: v.array(projectSummary),
  handler: async (ctx) => {
    const { subject } = await actor(ctx)
    // accessibleProjects already returns personal-recency order.
    const projects = await accessibleProjects(ctx, subject)
    return projects.map(({ project, role, lastWorkedAt }) =>
      summarize(project, role, lastWorkedAt)
    )
  },
})

/**
 * The caller's archived projects, newest-archived first. Owner-only: archiving
 * (and deleting) is an owner action, so only the owner's own archived projects
 * are listed here. Powers the Archived page, where each project can be
 * unarchived or permanently deleted.
 */
export const listArchived = query({
  args: {},
  returns: v.array(projectSummary),
  handler: async (ctx) => {
    const { subject } = await actor(ctx)
    // Read only *archived* owned projects off the shared index. The
    // `gt("archivedAt", 0)` lower bound excludes active projects (whose
    // archivedAt is undefined and sorts below any timestamp), so a large number
    // of active projects can never push archived ones out of this bounded read.
    // `order("desc")` yields newest-archived first.
    const archived = await ctx.db
      .query("projects")
      .withIndex("by_owner_archived_updated", (q) =>
        q.eq("ownerSubject", subject).gt("archivedAt", 0)
      )
      .order("desc")
      .take(MAX_PROJECTS)
    return archived.map((project) => summarize(project, "owner"))
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
      // The caller's personal "last worked on" timestamp, surfaced so the nav
      // can hint at recency too. Undefined until the caller checks in.
      lastWorkedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    const { subject } = await actor(ctx)
    const projects = await accessibleProjects(ctx, subject)
    return projects.map(({ project, role, lastWorkedAt }) => {
      const counts = projectCounts(project)
      return {
        _id: project._id,
        name: project.name,
        icon: project.icon,
        color: project.color,
        role,
        openCount: counts.todoCount + counts.inProgressCount,
        lastWorkedAt,
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
    const workState = await ctx.db
      .query("projectWorkStates")
      .withIndex("by_subject_project", (q) =>
        q.eq("subject", subject).eq("projectId", args.projectId)
      )
      .unique()
    const lastWorkedAt = workState?.lastWorkedAt
    if (project.ownerSubject === subject) {
      return summarize(project, "owner", lastWorkedAt)
    }
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_member", (q) =>
        q.eq("projectId", args.projectId).eq("subject", subject)
      )
      .unique()
    if (!membership) return null
    return summarize(project, "editor", lastWorkedAt)
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
    // Editing the project counts as personally working on it (creation does not).
    await touchProjectWorkState(
      ctx,
      who.subject,
      args.projectId,
      patch.updatedAt
    )
    return null
  },
})

/**
 * Mark that the caller personally worked on a project right now. Requires
 * access (owner or editor) and only ever touches the caller's own work state,
 * so checking in never disturbs a collaborator's dashboard recency. Writes no
 * shared Activity feed row. Returns the timestamp that was stored.
 */
export const markWorked = mutation({
  args: { projectId: v.id("projects") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { actor: who } = await requireProjectAccess(ctx, args.projectId)
    return await touchProjectWorkState(ctx, who.subject, args.projectId)
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
    // delete its tasks and every member's personal work-state row in background
    // batches. Batching keeps each transaction bounded and, unlike an inline
    // cap, never silently leaves rows behind for projects with many members.
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
 * personal work states and one batch of tasks per run, rescheduling itself
 * until both are drained. This keeps cleanup uncapped (no orphaned rows for
 * large projects) while each transaction stays within its document limits.
 */
export const purgeProjectData = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Personal work-state rows (one per member who worked on the project),
    // reachable by the by_project reverse index.
    const workStates = await ctx.db
      .query("projectWorkStates")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(PURGE_BATCH)
    for (const state of workStates) await ctx.db.delete(state._id)

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project_position", (q) =>
        q.eq("projectId", args.projectId)
      )
      .take(PURGE_BATCH)
    for (const task of tasks) await ctx.db.delete(task._id)

    if (workStates.length === PURGE_BATCH || tasks.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.projects.purgeProjectData, args)
    }
    return null
  },
})
