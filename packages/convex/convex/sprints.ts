import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server"
import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import { projectCounts, requireOrganization, statusCountField } from "./model"
import {
  activeSprintId,
  addTaskToSprint,
  cleanGoal,
  configuredDuration,
  ensureSettings,
  MAX_SPRINT_TASKS,
  removeTaskFromSprint,
} from "./sprintModel"
import { startSprintClose } from "./sprintRollover"
import { sprintBounds, validateDuration } from "./sprintTime"
import { taskCounts, taskStats } from "./taskModel"

const duration = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(4),
  v.literal("open")
)

const sprint = v.object({
  _id: v.id("sprints"),
  number: v.number(),
  goal: v.optional(v.string()),
  state: v.union(v.literal("current"), v.literal("closed")),
  startsAt: v.number(),
  endsAt: v.optional(v.number()),
  closedAt: v.optional(v.number()),
  baselineCount: v.optional(v.number()),
  completedCount: v.optional(v.number()),
})

function publicSprint(sprintDoc: Doc<"sprints">) {
  if (sprintDoc.state === "upcoming") {
    throw new Error("Future Sprints are not part of the Focus model")
  }
  return {
    _id: sprintDoc._id,
    number: sprintDoc.number,
    goal: sprintDoc.goal,
    state: sprintDoc.state,
    startsAt: sprintDoc.startsAt,
    endsAt: sprintDoc.endsAt,
    closedAt: sprintDoc.closedAt,
    baselineCount: sprintDoc.baselineCount,
    completedCount: sprintDoc.completedCount,
  }
}

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
    completedAt: taskDoc.completedAt,
    position: taskDoc.position,
    createdAt: taskDoc.createdAt,
    updatedAt: taskDoc.updatedAt,
    ...taskCounts(await taskStats(ctx, taskDoc._id)),
  }
}

async function tasksWithProjects(
  ctx: Parameters<typeof requireOrganization>[0],
  rows: Array<Doc<"tasks">>
) {
  if (rows.length > MAX_SPRINT_TASKS) {
    throw new ConvexError({
      code: "TASK_LIMIT",
      message: "This workspace exceeds the 1,000-task Focus limit.",
    })
  }
  const projects = new Map<string, Doc<"projects">>()
  const result = []
  for (const row of rows) {
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

async function settingsFor(
  ctx: Parameters<typeof requireOrganization>[0],
  organizationId: string
) {
  return await ctx.db
    .query("organizationSettings")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique()
}

export const current = query({
  args: {},
  returns: v.union(v.null(), v.object({ sprint, tasks: v.array(task) })),
  handler: async (ctx) => {
    const access = await requireOrganization(ctx)
    const settings = await settingsFor(ctx, access.organization.organizationId)
    if (!settings?.currentSprintId) return null
    const currentSprint = await ctx.db.get(settings.currentSprintId)
    if (!currentSprint || currentSprint.state !== "current") return null
    const rows = await ctx.db
      .query("tasks")
      .withIndex("by_organization_and_current_sprint", (q) =>
        q
          .eq("organizationId", access.organization.organizationId)
          .eq("currentSprintId", currentSprint._id)
      )
      .take(MAX_SPRINT_TASKS + 1)
    return {
      sprint: publicSprint(currentSprint),
      tasks: await tasksWithProjects(ctx, rows),
    }
  },
})

export const backlog = query({
  args: {},
  returns: v.array(task),
  handler: async (ctx) => {
    const access = await requireOrganization(ctx)
    const rows = await ctx.db
      .query("tasks")
      .withIndex("by_organization_and_backlog", (q) =>
        q
          .eq("organizationId", access.organization.organizationId)
          .eq("currentSprintId", undefined)
      )
      .filter((q) => q.neq(q.field("status"), "done"))
      .take(MAX_SPRINT_TASKS + 1)
    return await tasksWithProjects(ctx, rows)
  },
})

export const history = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(sprint),
  handler: async (ctx, args) => {
    const access = await requireOrganization(ctx)
    const result = await ctx.db
      .query("sprints")
      .withIndex("by_organization_and_state", (q) =>
        q
          .eq("organizationId", access.organization.organizationId)
          .eq("state", "closed")
      )
      .order("desc")
      .paginate(args.paginationOpts)
    return { ...result, page: result.page.map(publicSprint) }
  },
})

export const plan = mutation({
  args: { taskIds: v.array(v.id("tasks")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.taskIds.length === 0 || args.taskIds.length > MAX_SPRINT_TASKS) {
      throw new ConvexError({
        code: "INVALID_TASKS",
        message: "Choose between 1 and 1,000 tasks.",
      })
    }
    const access = await requireOrganization(ctx)
    const settings = await ensureSettings(
      ctx,
      access.organization.organizationId
    )
    const sprintId = await activeSprintId(ctx, settings)
    if (!sprintId) {
      throw new ConvexError({
        code: "SPRINT_STATE_INVALID",
        message: "Start a Sprint before adding focused work.",
      })
    }
    for (const taskId of new Set(args.taskIds)) {
      const taskDoc = await ctx.db.get(taskId)
      if (
        !taskDoc ||
        taskDoc.organizationId !== access.organization.organizationId
      ) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
      }
      if (taskDoc.status === "done") {
        throw new ConvexError({
          code: "TASK_COMPLETED",
          message: "Reopen a completed task before adding it.",
        })
      }
      if (taskDoc.currentSprintId === sprintId) continue
      const project = await ctx.db.get(taskDoc.projectId)
      if (!project) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Project not found.",
        })
      }
      await addTaskToSprint(ctx, {
        task: taskDoc,
        project,
        sprintId,
        actor: access.actor,
        origin: "planned",
      })
    }
    return null
  },
})

export const remove = mutation({
  args: { taskIds: v.array(v.id("tasks")) },
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
        throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." })
      }
      if (!taskDoc.currentSprintId) continue
      if (taskDoc.status === "done") {
        throw new ConvexError({
          code: "TASK_COMPLETED",
          message: "Completed Sprint work stays in its history.",
        })
      }
      await removeTaskFromSprint(ctx, {
        task: taskDoc,
        sprintId: taskDoc.currentSprintId,
        actor: access.actor,
        reason: "removed",
      })
      if (taskDoc.status === "inProgress") {
        const project = await ctx.db.get(taskDoc.projectId)
        await ctx.db.patch(taskDoc._id, {
          status: "todo",
          updatedAt: Date.now(),
        })
        if (project) {
          const counts = projectCounts(project)
          await ctx.db.patch(project._id, {
            [statusCountField.inProgress]: Math.max(
              0,
              counts.inProgressCount - 1
            ),
            [statusCountField.todo]: counts.todoCount + 1,
            updatedAt: Date.now(),
          })
        }
      }
    }
    return null
  },
})

export const updateGoal = mutation({
  args: { goal: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganization(ctx)
    const settings = await ensureSettings(
      ctx,
      access.organization.organizationId
    )
    const sprintId = await activeSprintId(ctx, settings)
    if (!sprintId) {
      throw new ConvexError({
        code: "SPRINT_STATE_INVALID",
        message: "Start a Sprint before setting its goal.",
      })
    }
    await ctx.db.patch(sprintId, {
      goal: cleanGoal(args.goal),
      updatedAt: Date.now(),
    })
    return null
  },
})

export const start = mutation({
  args: { goal: v.optional(v.string()), duration: v.optional(duration) },
  returns: v.id("sprints"),
  handler: async (ctx, args) => {
    const access = await requireOrganization(ctx)
    const organizationId = access.organization.organizationId
    const settings = await ensureSettings(ctx, organizationId)
    if (await activeSprintId(ctx, settings)) {
      throw new ConvexError({
        code: "SPRINT_ALREADY_ACTIVE",
        message: "End the current Sprint before starting another.",
      })
    }
    const selectedDuration = validateDuration(
      args.duration ?? configuredDuration(settings)
    )
    const now = Date.now()
    const bounds = sprintBounds(now, selectedDuration)
    const sprintId = await ctx.db.insert("sprints", {
      organizationId,
      number: settings.nextSprintNumber,
      goal: cleanGoal(args.goal),
      state: "current",
      ...bounds,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(settings._id, {
      sprintDuration: selectedDuration,
      currentSprintId: sprintId,
      upcomingSprintId: undefined,
      nextSprintNumber: settings.nextSprintNumber + 1,
      rolloverStatus: "idle",
      updatedAt: now,
    })
    if (bounds.endsAt !== undefined) {
      await ctx.scheduler.runAt(
        bounds.endsAt,
        internal.sprintRollover.scheduled,
        {
          organizationId,
          sprintId,
        }
      )
    }
    await ctx.db.insert("organizationActivity", {
      organizationId,
      actorUserId: access.actor.userId,
      actorName: access.actor.name,
      type: "sprint.started",
      sprintId,
      sprintNumber: settings.nextSprintNumber,
      createdAt: now,
    })
    return sprintId
  },
})

export const updateDuration = mutation({
  args: { duration },
  returns: v.null(),
  handler: async (ctx, args) => {
    const selectedDuration = validateDuration(args.duration)
    const access = await requireOrganization(ctx)
    const settings = await ensureSettings(
      ctx,
      access.organization.organizationId
    )
    if (configuredDuration(settings) === selectedDuration) return null
    const now = Date.now()
    await ctx.db.patch(settings._id, {
      sprintDuration: selectedDuration,
      updatedAt: now,
    })
    await ctx.db.insert("organizationActivity", {
      organizationId: access.organization.organizationId,
      actorUserId: access.actor.userId,
      actorName: access.actor.name,
      type: "sprint.duration_changed",
      detail: String(selectedDuration),
      createdAt: now,
    })
    return null
  },
})

export const end = mutation({
  args: { confirm: v.boolean() },
  returns: v.id("sprintRolloverJobs"),
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new ConvexError({
        code: "CONFIRMATION_REQUIRED",
        message: "Confirm that you want to end this Sprint.",
      })
    }
    const access = await requireOrganization(ctx)
    return await startSprintClose(ctx, {
      organizationId: access.organization.organizationId,
      early: true,
      actorUserId: access.actor.userId,
      actorName: access.actor.name,
    })
  },
})
