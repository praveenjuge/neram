import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { internalMutation, mutation, query } from "./_generated/server"
import {
  actor,
  projectCounts,
  recordActivity,
  requireProjectAccess,
  resolveAssignee,
  statusCountField,
  type Actor,
  type ProjectCounts,
} from "./model"
import { accessibleProjects } from "./projects"
import { status } from "./schema"
import {
  taskCounts,
  taskStats,
  unfinishedSubtasks,
  type TaskCounts,
} from "./taskModel"

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
  totalSubtasks: v.number(),
  completedSubtasks: v.number(),
  activeCommentCount: v.number(),
})

function publicTask(taskDoc: Doc<"tasks">, counts: TaskCounts) {
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
    ...counts,
  }
}

async function taskResult(
  ctx: Parameters<typeof taskStats>[0],
  taskDoc: Doc<"tasks">
) {
  return publicTask(taskDoc, taskCounts(await taskStats(ctx, taskDoc._id)))
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
    return await Promise.all(tasks.map((taskDoc) => taskResult(ctx, taskDoc)))
  },
})

export const get = query({
  args: { taskId: v.id("tasks") },
  returns: v.union(v.null(), task),
  handler: async (ctx, args) => {
    const taskDoc = await ctx.db.get(args.taskId)
    if (!taskDoc) return null
    try {
      await requireProjectAccess(ctx, taskDoc.projectId)
    } catch {
      return null
    }
    return await taskResult(ctx, taskDoc)
  },
})

// Each task in the cross-project Tasks list carries its project's display
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
  totalSubtasks: v.number(),
  completedSubtasks: v.number(),
  activeCommentCount: v.number(),
})

// Tasks across every project the caller can see (owned + shared), flattened
// into a single list. When `assignedToMe` is true (the default), only tasks
// assigned to the caller are returned. We read each project's board with the
// same per-project cap as `list`, then sort by most recent update so the
// freshest work surfaces first.
export const listAll = query({
  args: {
    assignedToMe: v.optional(v.boolean()),
  },
  returns: v.array(taskWithProject),
  handler: async (ctx, args) => {
    const { subject } = await actor(ctx)
    const onlyMine = args.assignedToMe ?? true
    const projects = await accessibleProjects(ctx, subject)
    const results: Array<
      Awaited<ReturnType<typeof taskResult>> & {
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
        if (onlyMine && taskDoc.assigneeSubject !== subject) continue
        results.push({
          ...(await taskResult(ctx, taskDoc)),
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
    expectedTitle: v.optional(v.string()),
    expectedDescription: v.optional(v.union(v.string(), v.null())),
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
    const now = Date.now()
    const patch: Partial<Doc<"tasks">> = { updatedAt: now }
    if (
      args.expectedTitle !== undefined &&
      current.title !== args.expectedTitle
    ) {
      throw new ConvexError({
        code: "EDIT_CONFLICT",
        message: "The task title changed while you were editing.",
        field: "title",
        latestValue: current.title,
      })
    }
    if (
      args.expectedDescription !== undefined &&
      (current.description ?? null) !== args.expectedDescription
    ) {
      throw new ConvexError({
        code: "EDIT_CONFLICT",
        message: "The task description changed while you were editing.",
        field: "description",
        latestValue: current.description ?? null,
      })
    }
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
    // Editing a task counts as activity on its project, so bump the project's
    // updatedAt to keep it near the top of the updatedAt-ordered project list.
    await ctx.db.patch(current.projectId, { updatedAt: now })

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
    return null
  },
})

export const move = mutation({
  // `position` is optional: drag-to-reorder passes an explicit value computed
  // from the drop location, while the "Move" menu omits it to append to the end.
  args: {
    taskId: v.id("tasks"),
    status,
    position: v.optional(v.number()),
    confirmIncompleteSubtasks: v.optional(v.boolean()),
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
    if (args.status === "done" && current.status !== "done") {
      const counts = taskCounts(await taskStats(ctx, current._id))
      const unfinishedCount = unfinishedSubtasks(counts)
      if (unfinishedCount > 0 && !args.confirmIncompleteSubtasks) {
        throw new ConvexError({
          code: "INCOMPLETE_SUBTASKS",
          message: `${unfinishedCount} subtask${unfinishedCount === 1 ? " is" : "s are"} unfinished.`,
          unfinishedCount,
          totalSubtasks: counts.totalSubtasks,
          completedSubtasks: counts.completedSubtasks,
        })
      }
    }
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
    const { project: source } = await requireProjectAccess(
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
    const stats = await taskStats(ctx, current._id)
    if (stats) {
      await ctx.db.patch(stats._id, { projectId: destination._id })
    }

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

    return null
  },
})

export const remove = mutation({
  args: {
    taskId: v.id("tasks"),
    confirmCascade: v.optional(v.boolean()),
  },
  returns: v.object({
    subtaskCount: v.number(),
    commentCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.taskId)
    if (!current) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
    }
    const { project, actor } = await requireProjectAccess(
      ctx,
      current.projectId
    )
    const counts = taskCounts(await taskStats(ctx, current._id))
    if (
      (counts.totalSubtasks > 0 || counts.activeCommentCount > 0) &&
      !args.confirmCascade
    ) {
      throw new ConvexError({
        code: "CASCADE_CONFIRMATION_REQUIRED",
        message: "Confirm deletion of this task and its children.",
        subtaskCount: counts.totalSubtasks,
        commentCount: counts.activeCommentCount,
      })
    }
    const now = Date.now()
    await ctx.db.delete(args.taskId)
    await ctx.scheduler.runAfter(0, internal.tasks.purgeTaskData, {
      taskId: args.taskId,
    })
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
    return {
      subtaskCount: counts.totalSubtasks,
      commentCount: counts.activeCommentCount,
    }
  },
})

const PURGE_BATCH = 100

/** Drain every child row for a deleted task in bounded scheduled batches. */
export const purgeTaskData = internalMutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [subtasks, comments] = await Promise.all([
      ctx.db
        .query("subtasks")
        .withIndex("by_task_position", (q) => q.eq("taskId", args.taskId))
        .take(PURGE_BATCH),
      ctx.db
        .query("taskComments")
        .withIndex("by_task_and_created", (q) => q.eq("taskId", args.taskId))
        .take(PURGE_BATCH),
    ])
    for (const row of subtasks) await ctx.db.delete(row._id)
    for (const row of comments) await ctx.db.delete(row._id)

    if (subtasks.length === PURGE_BATCH || comments.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.tasks.purgeTaskData, args)
      return null
    }
    const stats = await taskStats(ctx, args.taskId)
    if (stats) await ctx.db.delete(stats._id)
    return null
  },
})
