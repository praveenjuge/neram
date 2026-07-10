import { paginationOptsValidator } from "convex/server"
import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import { requireOrganization } from "./model"
import {
  addTaskToSprint,
  cleanGoal,
  ensureSprintPair,
  MAX_SPRINT_TASKS,
  removeTaskFromSprint,
} from "./sprintModel"
import { startRollover } from "./sprintRollover"
import { nextSprintBounds, validateCadence } from "./sprintTime"
import { taskCounts, taskStats } from "./taskModel"

const placement = v.union(
  v.literal("backlog"),
  v.literal("current"),
  v.literal("upcoming")
)

const sprint = v.object({
  _id: v.id("sprints"),
  _creationTime: v.number(),
  organizationId: v.string(),
  number: v.number(),
  goal: v.optional(v.string()),
  state: v.union(
    v.literal("current"),
    v.literal("upcoming"),
    v.literal("closed")
  ),
  startsAt: v.number(),
  endsAt: v.number(),
  closedCutoffAt: v.optional(v.number()),
  closedAt: v.optional(v.number()),
  earlyCloseActorUserId: v.optional(v.string()),
  earlyCloseActorName: v.optional(v.string()),
  earlyCloseReason: v.optional(v.string()),
  baselineCount: v.optional(v.number()),
  completedCount: v.optional(v.number()),
  carriedCount: v.optional(v.number()),
  addedCount: v.optional(v.number()),
  removedCount: v.optional(v.number()),
  reopenedCount: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

const task = v.object({
  _id: v.id("tasks"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  projectName: v.string(),
  projectIcon: v.optional(v.string()),
  projectColor: v.optional(v.string()),
  title: v.string(),
  description: v.optional(v.string()),
  dueDate: v.optional(v.string()),
  status: v.union(
    v.literal("todo"),
    v.literal("inProgress"),
    v.literal("done")
  ),
  assigneeSubject: v.optional(v.string()),
  assigneeName: v.optional(v.string()),
  currentSprintId: v.optional(v.id("sprints")),
  upcomingSprintId: v.optional(v.id("sprints")),
  completedAt: v.optional(v.number()),
  position: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  totalSubtasks: v.number(),
  completedSubtasks: v.number(),
  activeCommentCount: v.number(),
})

async function sprintTask(
  ctx: Parameters<typeof requireOrganization>[0],
  taskDoc: Doc<"tasks">,
  project: Doc<"projects">
) {
  return {
    _id: taskDoc._id,
    _creationTime: taskDoc._creationTime,
    projectId: taskDoc.projectId,
    projectName: project.name,
    projectIcon: project.icon,
    projectColor: project.color,
    title: taskDoc.title,
    description: taskDoc.description,
    dueDate: taskDoc.dueDate,
    status: taskDoc.status,
    assigneeSubject: taskDoc.assigneeSubject,
    assigneeName: taskDoc.assigneeName,
    currentSprintId: taskDoc.currentSprintId,
    upcomingSprintId: taskDoc.upcomingSprintId,
    completedAt: taskDoc.completedAt,
    position: taskDoc.position,
    createdAt: taskDoc.createdAt,
    updatedAt: taskDoc.updatedAt,
    ...taskCounts(await taskStats(ctx, taskDoc._id)),
  }
}

async function tasksWithProjects(
  ctx: Parameters<typeof requireOrganization>[0],
  organizationId: string,
  filter: (taskDoc: Doc<"tasks">) => boolean
) {
  const rows = await ctx.db
    .query("tasks")
    .withIndex("by_organization_and_updated_at", (q) =>
      q.eq("organizationId", organizationId)
    )
    .order("desc")
    .take(MAX_SPRINT_TASKS + 1)
  if (rows.length > MAX_SPRINT_TASKS) {
    throw new ConvexError({
      code: "TASK_LIMIT",
      message: "This workspace exceeds the 1,000-task board limit.",
    })
  }
  const projects = new Map<string, Doc<"projects">>()
  const result = []
  for (const row of rows) {
    if (!filter(row)) continue
    let project = projects.get(row.projectId)
    if (!project) {
      project = (await ctx.db.get(row.projectId)) ?? undefined
      if (project) projects.set(row.projectId, project)
    }
    if (project && project.archivedAt === undefined) {
      result.push(await sprintTask(ctx, row, project))
    }
  }
  return result
}

export const current = query({
  args: {},
  returns: v.union(v.null(), v.object({ sprint, tasks: v.array(task) })),
  handler: async (ctx) => {
    const access = await requireOrganization(ctx)
    const settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", access.organization.organizationId)
      )
      .unique()
    if (!settings?.currentSprintId) return null
    const currentSprint = await ctx.db.get(settings.currentSprintId)
    if (!currentSprint) return null
    const tasks = await tasksWithProjects(
      ctx,
      access.organization.organizationId,
      (row) => row.currentSprintId === currentSprint._id
    )
    return { sprint: currentSprint, tasks }
  },
})

export const backlog = query({
  args: {},
  returns: v.array(task),
  handler: async (ctx) => {
    const access = await requireOrganization(ctx)
    return await tasksWithProjects(
      ctx,
      access.organization.organizationId,
      (row) =>
        row.currentSprintId === undefined && row.upcomingSprintId === undefined
    )
  },
})

export const upcoming = query({
  args: {},
  returns: v.union(v.null(), v.object({ sprint, tasks: v.array(task) })),
  handler: async (ctx) => {
    const access = await requireOrganization(ctx)
    const settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", access.organization.organizationId)
      )
      .unique()
    if (!settings?.upcomingSprintId) return null
    const upcomingSprint = await ctx.db.get(settings.upcomingSprintId)
    if (!upcomingSprint) return null
    const tasks = await tasksWithProjects(
      ctx,
      access.organization.organizationId,
      (row) => row.upcomingSprintId === upcomingSprint._id
    )
    return { sprint: upcomingSprint, tasks }
  },
})

export const history = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireOrganization(ctx)
    return await ctx.db
      .query("sprints")
      .withIndex("by_organization_and_state", (q) =>
        q
          .eq("organizationId", access.organization.organizationId)
          .eq("state", "closed")
      )
      .order("desc")
      .paginate(args.paginationOpts)
  },
})

export const audit = query({
  args: { sprintId: v.id("sprints"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireOrganization(ctx)
    const sprintDoc = await ctx.db.get(args.sprintId)
    if (
      !sprintDoc ||
      sprintDoc.organizationId !== access.organization.organizationId
    ) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Sprint not found.",
      })
    }
    return await ctx.db
      .query("sprintTaskEntries")
      .withIndex("by_sprint_and_added_at", (q) =>
        q.eq("sprintId", args.sprintId)
      )
      .order("desc")
      .paginate(args.paginationOpts)
  },
})

export const initialize = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const access = await requireOrganization(ctx)
    const settings = await ensureSprintPair(
      ctx,
      access.organization.organizationId
    )
    const currentSprint = await ctx.db.get(settings.currentSprintId!)
    if (currentSprint) {
      await ctx.scheduler.runAt(
        currentSprint.endsAt,
        internal.sprintRollover.scheduled,
        {
          organizationId: access.organization.organizationId,
          sprintId: currentSprint._id,
        }
      )
    }
    return null
  },
})

export const plan = mutation({
  args: { taskIds: v.array(v.id("tasks")), sprint: placement },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.taskIds.length === 0 || args.taskIds.length > MAX_SPRINT_TASKS) {
      throw new ConvexError({
        code: "INVALID_TASKS",
        message: "Choose between 1 and 1,000 tasks.",
      })
    }
    const access = await requireOrganization(ctx)
    const settings = await ensureSprintPair(
      ctx,
      access.organization.organizationId
    )
    for (const taskId of new Set(args.taskIds)) {
      const taskDoc = await ctx.db.get(taskId)
      if (
        !taskDoc ||
        taskDoc.organizationId !== access.organization.organizationId
      ) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Task not found.",
        })
      }
      const project = await ctx.db.get(taskDoc.projectId)
      if (!project)
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Project not found.",
        })
      if (taskDoc.status === "done") {
        throw new ConvexError({
          code: "TASK_COMPLETED",
          message: "Reopen a completed task before planning it.",
        })
      }
      if (taskDoc.currentSprintId) {
        await removeTaskFromSprint(ctx, {
          task: taskDoc,
          sprintId: taskDoc.currentSprintId,
          actor: access.actor,
          reason: "replanned",
        })
      }
      if (taskDoc.upcomingSprintId) {
        await removeTaskFromSprint(ctx, {
          task: taskDoc,
          sprintId: taskDoc.upcomingSprintId,
          actor: access.actor,
          reason: "replanned",
        })
      }
      if (args.sprint !== "backlog") {
        await addTaskToSprint(ctx, {
          task: {
            ...taskDoc,
            currentSprintId: undefined,
            upcomingSprintId: undefined,
          },
          project,
          sprintId:
            args.sprint === "current"
              ? settings.currentSprintId!
              : settings.upcomingSprintId!,
          actor: access.actor,
          origin: args.sprint === "current" ? "scope_added" : "planned",
        })
      }
    }
    return null
  },
})

export const remove = mutation({
  args: {
    taskIds: v.array(v.id("tasks")),
    sprint: v.union(v.literal("current"), v.literal("upcoming")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.taskIds.length === 0 || args.taskIds.length > MAX_SPRINT_TASKS) {
      throw new ConvexError({
        code: "INVALID_TASKS",
        message: "Choose between 1 and 1,000 tasks.",
      })
    }
    const access = await requireOrganization(ctx)
    for (const taskId of new Set(args.taskIds)) {
      const taskDoc = await ctx.db.get(taskId)
      if (
        !taskDoc ||
        taskDoc.organizationId !== access.organization.organizationId
      ) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Task not found.",
        })
      }
      const sprintId =
        args.sprint === "current"
          ? taskDoc.currentSprintId
          : taskDoc.upcomingSprintId
      if (!sprintId) continue
      if (args.sprint === "current" && taskDoc.status === "done") {
        throw new ConvexError({
          code: "TASK_COMPLETED",
          message: "Completed Current work cannot be removed.",
        })
      }
      await removeTaskFromSprint(ctx, {
        task: taskDoc,
        sprintId,
        actor: access.actor,
        reason: "removed",
      })
      if (args.sprint === "current" && taskDoc.status === "inProgress") {
        await ctx.db.patch(taskDoc._id, {
          status: "todo",
          updatedAt: Date.now(),
        })
      }
    }
    return null
  },
})

export const updateGoal = mutation({
  args: {
    sprint: v.union(v.literal("current"), v.literal("upcoming")),
    goal: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganization(ctx)
    const settings = await ensureSprintPair(
      ctx,
      access.organization.organizationId
    )
    const sprintId =
      args.sprint === "current"
        ? settings.currentSprintId!
        : settings.upcomingSprintId!
    await ctx.db.patch(sprintId, {
      goal: cleanGoal(args.goal),
      updatedAt: Date.now(),
    })
    return null
  },
})

export const updateCadence = mutation({
  args: {
    cadenceWeeks: v.number(),
    startWeekday: v.number(),
    timezone: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    validateCadence(args)
    const access = await requireOrganization(ctx)
    const settings = await ensureSprintPair(
      ctx,
      access.organization.organizationId
    )
    const upcomingSprint = await ctx.db.get(settings.upcomingSprintId!)
    if (!upcomingSprint)
      throw new ConvexError({
        code: "SPRINT_STATE_INVALID",
        message: "Upcoming Sprint is missing.",
      })
    const now = Date.now()
    const bounds = nextSprintBounds(upcomingSprint.startsAt, args)
    await ctx.db.patch(upcomingSprint._id, {
      endsAt: bounds.endsAt,
      updatedAt: now,
    })
    await ctx.db.patch(settings._id, { ...args, updatedAt: now })
    await ctx.db.insert("organizationActivity", {
      organizationId: access.organization.organizationId,
      actorUserId: access.actor.userId,
      actorName: access.actor.name,
      type: "sprint.cadence_changed",
      detail: `${args.cadenceWeeks}|${args.startWeekday}|${args.timezone}`,
      createdAt: now,
    })
    return null
  },
})

export const rollover = mutation({
  args: { confirm: v.boolean(), reason: v.string() },
  returns: v.id("sprintRolloverJobs"),
  handler: async (ctx, args) => {
    const reason = args.reason.trim()
    if (!args.confirm || reason.length < 1 || reason.length > 500) {
      throw new ConvexError({
        code: "CONFIRMATION_REQUIRED",
        message: "Confirm early rollover and provide a reason.",
      })
    }
    const access = await requireOrganization(ctx)
    return await startRollover(ctx, {
      organizationId: access.organization.organizationId,
      early: true,
      actorUserId: access.actor.userId,
      actorName: access.actor.name,
      reason,
    })
  },
})
