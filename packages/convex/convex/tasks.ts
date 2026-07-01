import { ConvexError, v } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import {
  actor,
  projectCounts,
  recordActivity,
  requireProjectAccess,
  resolveAssignee,
  statusCountField,
  touchProjectWorkState,
  type Actor,
  type ProjectCounts,
} from "./model"
import { accessibleProjects } from "./projects"
import { status } from "./schema"

// Upper bound for a single board load. A kanban board renders every card, so we
// don't paginate, but we cap the read so the query stays bounded as data grows.
const MAX_TASKS = 1000

const task = v.object({
  _id: v.id("tasks"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  title: v.string(),
  description: v.optional(v.string()),
  dueDate: v.optional(v.string()),
  status,
  assigneeSubject: v.optional(v.string()),
  assigneeName: v.optional(v.string()),
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
    description: taskDoc.description,
    dueDate: taskDoc.dueDate,
    status: taskDoc.status,
    assigneeSubject: taskDoc.assigneeSubject,
    assigneeName: taskDoc.assigneeName,
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

// Description is free-form and optional. Trim it, drop it when empty, and cap
// the length so a single task can't store an unbounded blob.
function cleanDescription(description?: string) {
  if (description === undefined) return undefined
  const trimmed = description.trim()
  if (trimmed.length === 0) return undefined
  if (trimmed.length > 2000) {
    throw new ConvexError({
      code: "INVALID_DESCRIPTION",
      message: "Use at most 2000 characters.",
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

export const list = query({
  args: { projectId: v.id("projects") },
  returns: v.array(task),
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId)
    // Ordered by position ascending via the index, so each column renders in
    // the right order without a client-side sort. Keyed only off the project so
    // collaborators (who don't know the owner's subject) can read the board.
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project_position", (q) =>
        q.eq("projectId", args.projectId)
      )
      .take(MAX_TASKS)
    return tasks.map(publicTask)
  },
})

// Each task in the cross-project "My Tasks" list carries its project's display
// fields so the page can show where the task lives without a second lookup.
const taskWithProject = v.object({
  _id: v.id("tasks"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  projectName: v.string(),
  projectIcon: v.optional(v.string()),
  projectColor: v.optional(v.string()),
  title: v.string(),
  description: v.optional(v.string()),
  dueDate: v.optional(v.string()),
  status,
  assigneeSubject: v.optional(v.string()),
  assigneeName: v.optional(v.string()),
  position: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

// Every task assigned to the caller across the projects they can see (owned +
// shared), flattened into a single list for the "My Tasks" page. We read each
// project's board with the same per-project cap as `list`, keep only the
// caller's assigned tasks, then sort by most recent update so the freshest work
// surfaces first.
export const listAll = query({
  args: {},
  returns: v.array(taskWithProject),
  handler: async (ctx) => {
    const { subject } = await actor(ctx)
    const projects = await accessibleProjects(ctx, subject)
    const results: Array<
      ReturnType<typeof publicTask> & {
        projectName: string
        projectIcon?: string
        projectColor?: string
      }
    > = []
    for (const { project } of projects) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_project_position", (q) => q.eq("projectId", project._id))
        .take(MAX_TASKS)
      for (const taskDoc of tasks) {
        // My Tasks shows only what's assigned to the caller.
        if (taskDoc.assigneeSubject !== subject) continue
        results.push({
          ...publicTask(taskDoc),
          projectName: project.name,
          projectIcon: project.icon,
          projectColor: project.color,
        })
      }
    }
    results.sort((a, b) => b.updatedAt - a.updatedAt)
    return results
  },
})

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    assigneeSubject: v.optional(v.string()),
    // Display hint used only for the optimistic UI; the server stores the
    // authoritative name resolved from the project's membership.
    assigneeName: v.optional(v.string()),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const { project, actor } = await requireProjectAccess(ctx, args.projectId)
    const now = Date.now()
    const title = cleanTitle(args.title)
    const assignee = args.assigneeSubject
      ? await resolveAssignee(ctx, project, args.assigneeSubject)
      : null
    const taskId = await ctx.db.insert("tasks", {
      // Keep the owner's subject as a consistent key; it's no longer the access
      // gate (that's the membership check) but stays set for every task.
      ownerSubject: project.ownerSubject,
      projectId: args.projectId,
      title,
      description: cleanDescription(args.description),
      dueDate: cleanDueDate(args.dueDate),
      status: "todo",
      assigneeSubject: assignee?.subject,
      assigneeName: assignee?.name,
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
    await recordActivity(ctx, {
      project,
      actor,
      type: "task.created",
      taskTitle: title,
    })
    // Notify the assignee (and the rest of the project) when a task starts out
    // assigned to someone.
    if (assignee) {
      await recordActivity(ctx, {
        project,
        actor,
        type: "task.assigned",
        taskTitle: title,
        assigneeSubject: assignee.subject,
        assigneeName: assignee.name,
      })
    }
    // The actor just worked on this project; bump their personal recency.
    await touchProjectWorkState(ctx, actor.subject, args.projectId, now)
    return taskId
  },
})

// Edit a task's editable fields (title, description, due date). Status changes
// go through `move` so the project counters and activity feed stay correct.
export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    // Pass a subject to (re)assign, or an empty string to clear the assignee.
    // Omit the field to leave the assignment untouched.
    assigneeSubject: v.optional(v.string()),
    // Display hint for the optimistic UI; the server resolves the real name.
    assigneeName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.taskId)
    if (!current) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
    }
    const { project, actor } = await requireProjectAccess(
      ctx,
      current.projectId
    )
    const patch: Partial<Doc<"tasks">> = { updatedAt: Date.now() }
    if (args.title !== undefined) patch.title = cleanTitle(args.title)
    if (args.description !== undefined) {
      patch.description = cleanDescription(args.description)
    }
    if (args.dueDate !== undefined) patch.dueDate = cleanDueDate(args.dueDate)

    let newlyAssigned: Actor | null = null
    if (args.assigneeSubject !== undefined) {
      if (args.assigneeSubject === "") {
        // Empty string clears the assignment (mirrors the field cleaners).
        patch.assigneeSubject = undefined
        patch.assigneeName = undefined
      } else {
        const assignee = await resolveAssignee(
          ctx,
          project,
          args.assigneeSubject
        )
        patch.assigneeSubject = assignee.subject
        patch.assigneeName = assignee.name
        // Only log assignment activity when the assignee actually changes.
        if (current.assigneeSubject !== assignee.subject) {
          newlyAssigned = assignee
        }
      }
    }

    await ctx.db.patch(args.taskId, patch)

    if (newlyAssigned) {
      await recordActivity(ctx, {
        project,
        actor,
        type: "task.assigned",
        taskTitle: patch.title ?? current.title,
        assigneeSubject: newlyAssigned.subject,
        assigneeName: newlyAssigned.name,
      })
    }
    // Editing a task counts as working on its project for the actor.
    await touchProjectWorkState(ctx, actor.subject, current.projectId)
    return null
  },
})

export const move = mutation({
  // `position` is optional: drag-to-reorder passes an explicit value computed
  // from the drop location, while the "Move" menu omits it to append to the end.
  args: { taskId: v.id("tasks"), status, position: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.taskId)
    if (!current) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
    }
    const { project, actor } = await requireProjectAccess(
      ctx,
      current.projectId
    )
    const now = Date.now()
    const position = args.position ?? now
    await ctx.db.patch(args.taskId, {
      status: args.status,
      position,
      updatedAt: now,
    })

    // Only touch the project doc + feed when the status actually changed: pure
    // reorders within a column leave the counts (and the dashboard sort)
    // untouched and shouldn't spam the activity feed.
    if (current.status !== args.status) {
      const from = statusCountField[current.status]
      const to = statusCountField[args.status]
      const patch: Partial<ProjectCounts> & { updatedAt: number } = {
        updatedAt: now,
      }
      patch[from] = Math.max(0, projectCounts(project)[from] - 1)
      patch[to] = projectCounts(project)[to] + 1
      await ctx.db.patch(current.projectId, patch)
      await recordActivity(ctx, {
        project,
        actor,
        type: "task.moved",
        taskTitle: current.title,
        toStatus: args.status,
      })
    }
    // Moving or reordering a card counts as working on the project, even when
    // the status is unchanged (a pure within-column reorder).
    await touchProjectWorkState(ctx, actor.subject, current.projectId, now)
    return null
  },
})

// Move a task to a different project the caller can also access. The status
// carries over, the card re-homes at the end of the destination board, the
// denormalized counters shift off the source project onto the destination, and
// the assignee is cleared when they aren't a member of the destination.
export const changeProject = mutation({
  args: { taskId: v.id("tasks"), projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.taskId)
    if (!current) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
    }
    // Already there: nothing to move.
    if (current.projectId === args.projectId) return null

    // The caller must be able to access both ends of the move.
    const { project: source, actor } = await requireProjectAccess(
      ctx,
      current.projectId
    )
    const { project: destination } = await requireProjectAccess(
      ctx,
      args.projectId
    )

    const now = Date.now()

    // The current assignee may not belong to the destination project; keep them
    // only when they're still a valid member there, otherwise drop the
    // assignment so a task can't reference a stranger.
    let assigneeSubject = current.assigneeSubject
    let assigneeName = current.assigneeName
    if (assigneeSubject) {
      try {
        const assignee = await resolveAssignee(
          ctx,
          destination,
          assigneeSubject
        )
        assigneeSubject = assignee.subject
        assigneeName = assignee.name
      } catch {
        assigneeSubject = undefined
        assigneeName = undefined
      }
    }

    await ctx.db.patch(args.taskId, {
      projectId: args.projectId,
      // Keep ownerSubject aligned with the destination owner, mirroring create.
      ownerSubject: destination.ownerSubject,
      // Append to the end of the destination board; the status is preserved.
      position: now,
      assigneeSubject,
      assigneeName,
      updatedAt: now,
    })

    // Shift the task's counters off the source project and onto the
    // destination, keeping both projects' denormalized counts consistent.
    const field = statusCountField[current.status]
    const fromPatch: Partial<ProjectCounts> & { updatedAt: number } = {
      updatedAt: now,
    }
    fromPatch.taskCount = Math.max(0, source.taskCount - 1)
    fromPatch[field] = Math.max(0, projectCounts(source)[field] - 1)
    await ctx.db.patch(source._id, fromPatch)

    const toPatch: Partial<ProjectCounts> & { updatedAt: number } = {
      updatedAt: now,
    }
    toPatch.taskCount = destination.taskCount + 1
    toPatch[field] = projectCounts(destination)[field] + 1
    await ctx.db.patch(destination._id, toPatch)

    // The actor just worked on both projects.
    await touchProjectWorkState(ctx, actor.subject, source._id, now)
    await touchProjectWorkState(ctx, actor.subject, destination._id, now)
    return null
  },
})

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.taskId)
    if (!current) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
    }
    const { project, actor } = await requireProjectAccess(
      ctx,
      current.projectId
    )
    const now = Date.now()
    await ctx.db.delete(args.taskId)
    const field = statusCountField[current.status]
    const patch: Partial<ProjectCounts> & { updatedAt: number } = {
      updatedAt: now,
    }
    patch.taskCount = Math.max(0, project.taskCount - 1)
    patch[field] = Math.max(0, projectCounts(project)[field] - 1)
    await ctx.db.patch(current.projectId, patch)
    await recordActivity(ctx, {
      project,
      actor,
      type: "task.deleted",
      taskTitle: current.title,
    })
    // Deleting a task is still working on the project for the actor.
    await touchProjectWorkState(ctx, actor.subject, current.projectId, now)
    return null
  },
})
