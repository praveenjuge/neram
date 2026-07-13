import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server"
import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import { projectCounts, requireOrganization, statusCountField } from "./model"
import {
  activeSprintId,
  addTaskToSprint,
  cleanGoal,
  cleanName,
  ensureSettings,
  MAX_SCHEDULED_SPRINTS,
  MAX_SPRINT_TASKS,
  removeTaskFromSprint,
  upcomingSprints,
} from "./sprintModel"
import { startRollover } from "./sprintRollover"
import {
  initialSprintBounds,
  nextSprintBounds,
  validateCadence,
} from "./sprintTime"
import { taskCounts, taskStats } from "./taskModel"

// Where planned work can land. "current"/"upcoming" are convenience aliases for
// the active Sprint and the soonest scheduled Sprint; a concrete Sprint id
// targets any specific future Sprint when several are scheduled ahead.
const placement = v.union(
  v.literal("backlog"),
  v.literal("current"),
  v.literal("upcoming"),
  v.id("sprints")
)

// A live Sprint that already holds work: the active Sprint, the soonest
// scheduled one, or a specific scheduled Sprint addressed by id.
const sprintTarget = v.union(
  v.literal("current"),
  v.literal("upcoming"),
  v.id("sprints")
)

const sprint = v.object({
  _id: v.id("sprints"),
  _creationTime: v.number(),
  organizationId: v.string(),
  number: v.number(),
  name: v.optional(v.string()),
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

const sprintEntry = v.object({
  _id: v.id("sprintTaskEntries"),
  _creationTime: v.number(),
  organizationId: v.string(),
  sprintId: v.id("sprints"),
  taskId: v.id("tasks"),
  projectId: v.id("projects"),
  projectNameSnapshot: v.string(),
  taskTitleSnapshot: v.string(),
  origin: v.union(
    v.literal("planned"),
    v.literal("carried"),
    v.literal("scope_added"),
    v.literal("reopened")
  ),
  actorUserId: v.string(),
  actorName: v.string(),
  addedAt: v.number(),
  removedAt: v.optional(v.number()),
  removedByUserId: v.optional(v.string()),
  removedByName: v.optional(v.string()),
  removalReason: v.optional(v.string()),
  creditedCompletionAt: v.optional(v.number()),
  carriedToSprintId: v.optional(v.id("sprints")),
  priorCompletionSprintId: v.optional(v.id("sprints")),
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
  rows: Array<Doc<"tasks">>
) {
  if (rows.length > MAX_SPRINT_TASKS) {
    throw new ConvexError({
      code: "TASK_LIMIT",
      message: "This workspace exceeds the 1,000-task board limit.",
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

async function currentTasks(
  ctx: Parameters<typeof requireOrganization>[0],
  organizationId: string,
  sprintId: Doc<"sprints">["_id"]
) {
  return await ctx.db
    .query("tasks")
    .withIndex("by_organization_and_current_sprint", (q) =>
      q.eq("organizationId", organizationId).eq("currentSprintId", sprintId)
    )
    .take(MAX_SPRINT_TASKS + 1)
}

async function upcomingTasks(
  ctx: Parameters<typeof requireOrganization>[0],
  organizationId: string,
  sprintId: Doc<"sprints">["_id"]
) {
  return await ctx.db
    .query("tasks")
    .withIndex("by_organization_and_upcoming_sprint", (q) =>
      q.eq("organizationId", organizationId).eq("upcomingSprintId", sprintId)
    )
    .take(MAX_SPRINT_TASKS + 1)
}

async function backlogTasks(
  ctx: Parameters<typeof requireOrganization>[0],
  organizationId: string
) {
  const rows = await ctx.db
    .query("tasks")
    .withIndex("by_organization_and_backlog", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("currentSprintId", undefined)
        .eq("upcomingSprintId", undefined)
    )
    .take(MAX_SPRINT_TASKS + 1)
  return rows
}

type SprintCtx = Parameters<typeof requireOrganization>[0]

async function organizationSettings(ctx: SprintCtx, organizationId: string) {
  return await ctx.db
    .query("organizationSettings")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique()
}

/**
 * Resolve a placement union to a concrete Sprint id, or null for the Backlog.
 * "current"/"upcoming" read the denormalized pointers (upcoming = soonest
 * scheduled Sprint); a concrete id is validated to belong to this Organization
 * and to still be open so closed history can never be targeted.
 */
async function resolveSprintTarget(
  ctx: SprintCtx,
  organizationId: string,
  settings: Pick<
    Doc<"organizationSettings">,
    "currentSprintId" | "upcomingSprintId"
  >,
  target: "backlog" | "current" | "upcoming" | Id<"sprints">
): Promise<Id<"sprints"> | null> {
  if (target === "backlog") return null
  if (target === "current" || target === "upcoming") {
    const pointer =
      target === "current"
        ? settings.currentSprintId
        : settings.upcomingSprintId
    if (!pointer) {
      throw new ConvexError({
        code: "SPRINT_STATE_INVALID",
        message: `The ${target} Sprint is unavailable.`,
      })
    }
    return pointer
  }
  const sprintDoc = await ctx.db.get(target)
  if (
    !sprintDoc ||
    sprintDoc.organizationId !== organizationId ||
    sprintDoc.state === "closed"
  ) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Sprint not found." })
  }
  return sprintDoc._id
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
      await currentTasks(
        ctx,
        access.organization.organizationId,
        currentSprint._id
      )
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
      await backlogTasks(ctx, access.organization.organizationId)
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
      await upcomingTasks(
        ctx,
        access.organization.organizationId,
        upcomingSprint._id
      )
    )
    return { sprint: upcomingSprint, tasks }
  },
})

// Every scheduled future Sprint (soonest first) with its planned tasks. Powers
// the Upcoming tab where several Sprints can be scheduled and planned ahead.
export const upcomingList = query({
  args: {},
  returns: v.array(v.object({ sprint, tasks: v.array(task) })),
  handler: async (ctx) => {
    const access = await requireOrganization(ctx)
    const sprints = await upcomingSprints(
      ctx,
      access.organization.organizationId
    )
    const result: Array<{
      sprint: Doc<"sprints">
      tasks: Awaited<ReturnType<typeof tasksWithProjects>>
    }> = []
    for (const upcomingSprint of sprints) {
      const tasks = await tasksWithProjects(
        ctx,
        await upcomingTasks(
          ctx,
          access.organization.organizationId,
          upcomingSprint._id
        )
      )
      result.push({ sprint: upcomingSprint, tasks })
    }
    return result
  },
})

export const history = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(sprint),
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
  returns: paginationResultValidator(sprintEntry),
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
    const settings = await ensureSettings(
      ctx,
      access.organization.organizationId
    )
    const targetSprintId = await resolveSprintTarget(
      ctx,
      access.organization.organizationId,
      settings,
      args.sprint
    )
    // Adding to the active Sprint mid-flight is scope growth; planning into any
    // scheduled future Sprint is baseline planning.
    const targetSprint = targetSprintId
      ? await ctx.db.get(targetSprintId)
      : null
    const origin = targetSprint?.state === "current" ? "scope_added" : "planned"
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
      if (
        (targetSprintId === null &&
          !taskDoc.currentSprintId &&
          !taskDoc.upcomingSprintId) ||
        (targetSprintId !== null &&
          (taskDoc.currentSprintId === targetSprintId ||
            taskDoc.upcomingSprintId === targetSprintId))
      ) {
        continue
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
      if (targetSprintId !== null) {
        await addTaskToSprint(ctx, {
          task: {
            ...taskDoc,
            currentSprintId: undefined,
            upcomingSprintId: undefined,
          },
          project,
          sprintId: targetSprintId,
          actor: access.actor,
          origin,
        })
      }
    }
    return null
  },
})

export const remove = mutation({
  args: {
    taskIds: v.array(v.id("tasks")),
    sprint: sprintTarget,
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
    const settings = await organizationSettings(
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
      const sprintId =
        args.sprint === "current"
          ? taskDoc.currentSprintId
          : args.sprint === "upcoming"
            ? taskDoc.upcomingSprintId
            : taskDoc.currentSprintId === args.sprint ||
                taskDoc.upcomingSprintId === args.sprint
              ? args.sprint
              : undefined
      if (!sprintId) continue
      // Completion and in-progress rules only apply to the active Sprint,
      // whichever alias or id was used to address it.
      const removingFromCurrent = sprintId === settings?.currentSprintId
      if (removingFromCurrent && taskDoc.status === "done") {
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
      if (removingFromCurrent && taskDoc.status === "inProgress") {
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
  args: {
    sprint: sprintTarget,
    goal: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganization(ctx)
    const settings = await ensureSettings(
      ctx,
      access.organization.organizationId
    )
    const sprintId = await resolveSprintTarget(
      ctx,
      access.organization.organizationId,
      settings,
      args.sprint
    )
    if (!sprintId) {
      throw new ConvexError({
        code: "SPRINT_STATE_INVALID",
        message: "Choose a Sprint to update.",
      })
    }
    await ctx.db.patch(sprintId, {
      goal: cleanGoal(args.goal),
      updatedAt: Date.now(),
    })
    return null
  },
})

// Create a Sprint. With no active Sprint, the new one becomes Current and
// starts now; otherwise it is appended to the scheduled queue with dates
// chained contiguously from the last one using the active cadence.
export const scheduleSprint = mutation({
  args: { name: v.optional(v.string()), goal: v.optional(v.string()) },
  returns: v.id("sprints"),
  handler: async (ctx, args) => {
    const access = await requireOrganization(ctx)
    const organizationId = access.organization.organizationId
    const settings = await ensureSettings(ctx, organizationId)
    const now = Date.now()
    const currentId = await activeSprintId(ctx, settings)

    // The first Sprint (or the first after everything has closed) becomes the
    // active Sprint and starts immediately.
    if (!currentId) {
      const bounds = initialSprintBounds(now, settings)
      const sprintId = await ctx.db.insert("sprints", {
        organizationId,
        number: settings.nextSprintNumber,
        name: cleanName(args.name),
        goal: cleanGoal(args.goal),
        state: "current",
        ...bounds,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.patch(settings._id, {
        currentSprintId: sprintId,
        nextSprintNumber: settings.nextSprintNumber + 1,
        rolloverStatus: "idle",
        updatedAt: now,
      })
      await ctx.scheduler.runAt(
        bounds.endsAt,
        internal.sprintRollover.scheduled,
        { organizationId, sprintId }
      )
      return sprintId
    }

    const scheduled = await upcomingSprints(ctx, organizationId)
    if (scheduled.length >= MAX_SCHEDULED_SPRINTS) {
      throw new ConvexError({
        code: "SPRINT_SCHEDULE_LIMIT",
        message: `You can schedule at most ${MAX_SCHEDULED_SPRINTS} Sprints ahead.`,
      })
    }
    // Chain from the last scheduled Sprint, or the active Sprint when the queue
    // is empty.
    const anchor = scheduled.at(-1) ?? (await ctx.db.get(currentId))!
    const bounds = nextSprintBounds(anchor.endsAt, settings)
    const sprintId = await ctx.db.insert("sprints", {
      organizationId,
      number: settings.nextSprintNumber,
      name: cleanName(args.name),
      goal: cleanGoal(args.goal),
      state: "upcoming",
      ...bounds,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(settings._id, {
      nextSprintNumber: settings.nextSprintNumber + 1,
      // The first scheduled Sprint becomes the Upcoming pointer for rollover.
      ...(scheduled.length === 0 ? { upcomingSprintId: sprintId } : {}),
      updatedAt: now,
    })
    return sprintId
  },
})

// Rename any live Sprint (active or scheduled). Clearing the name falls back to
// the "Sprint {number}" display label.
export const renameSprint = mutation({
  args: { sprint: sprintTarget, name: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganization(ctx)
    const settings = await ensureSettings(
      ctx,
      access.organization.organizationId
    )
    const sprintId = await resolveSprintTarget(
      ctx,
      access.organization.organizationId,
      settings,
      args.sprint
    )
    if (!sprintId) {
      throw new ConvexError({
        code: "SPRINT_STATE_INVALID",
        message: "Choose a Sprint to rename.",
      })
    }
    await ctx.db.patch(sprintId, {
      name: cleanName(args.name),
      updatedAt: Date.now(),
    })
    return null
  },
})

// Remove a scheduled (upcoming) Sprint and return its planned work to the
// Backlog. Any upcoming Sprint can be removed; the active Sprint cannot.
export const unscheduleSprint = mutation({
  args: { sprintId: v.id("sprints") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganization(ctx)
    const organizationId = access.organization.organizationId
    const settings = await ensureSettings(ctx, organizationId)
    if (settings.rolloverStatus === "running") {
      throw new ConvexError({
        code: "SPRINT_ROLLOVER_RUNNING",
        message: "Sprint planning is paused while rollover completes.",
      })
    }
    const target = await ctx.db.get(args.sprintId)
    if (!target || target.organizationId !== organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sprint not found." })
    }
    if (target.state !== "upcoming") {
      throw new ConvexError({
        code: "SPRINT_NOT_UPCOMING",
        message: "Only a scheduled Sprint can be removed.",
      })
    }
    const now = Date.now()
    // Return planned tasks to the Backlog by clearing their placement ref.
    const planned = await ctx.db
      .query("tasks")
      .withIndex("by_organization_and_upcoming_sprint", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("upcomingSprintId", target._id)
      )
      .take(MAX_SPRINT_TASKS + 1)
    for (const taskDoc of planned) {
      await ctx.db.patch(taskDoc._id, {
        upcomingSprintId: undefined,
        updatedAt: now,
      })
    }
    // The Sprint never started, so its append-only entries carry no closed
    // history; delete them with the Sprint to avoid orphaned audit rows.
    const entries = await ctx.db
      .query("sprintTaskEntries")
      .withIndex("by_sprint_and_added_at", (q) => q.eq("sprintId", target._id))
      .take(MAX_SPRINT_TASKS + 1)
    for (const entry of entries) {
      await ctx.db.delete(entry._id)
    }
    await ctx.db.delete(target._id)
    // Keep the Upcoming pointer aimed at the soonest remaining scheduled Sprint.
    if (settings.upcomingSprintId === target._id) {
      const remaining = await upcomingSprints(ctx, organizationId)
      await ctx.db.patch(settings._id, {
        upcomingSprintId: remaining[0]?._id,
        updatedAt: now,
      })
    }
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
    const settings = await ensureSettings(
      ctx,
      access.organization.organizationId
    )
    if (
      settings.cadenceWeeks === args.cadenceWeeks &&
      settings.startWeekday === args.startWeekday &&
      settings.timezone === args.timezone
    ) {
      return null
    }
    const now = Date.now()
    const currentSprint = settings.currentSprintId
      ? await ctx.db.get(settings.currentSprintId)
      : null
    // Never touch the active Sprint's locked dates; re-flow every scheduled
    // Sprint contiguously from where it ends, or from now when none is active.
    const scheduled = await upcomingSprints(
      ctx,
      access.organization.organizationId
    )
    let anchor = currentSprint?.endsAt ?? now
    for (const upcomingSprint of scheduled) {
      const bounds = nextSprintBounds(anchor, args)
      await ctx.db.patch(upcomingSprint._id, {
        startsAt: bounds.startsAt,
        endsAt: bounds.endsAt,
        updatedAt: now,
      })
      anchor = bounds.endsAt
    }
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
  args: {
    organizationId: v.string(),
    slug: v.string(),
    confirm: v.boolean(),
    reason: v.string(),
  },
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
    if (
      args.organizationId !== access.organization.organizationId ||
      args.slug !== access.organization.slug
    ) {
      throw new ConvexError({
        code: "CONFIRMATION_REQUIRED",
        message: "Confirm with the exact workspace ID and slug.",
      })
    }
    return await startRollover(ctx, {
      organizationId: access.organization.organizationId,
      early: true,
      actorUserId: access.actor.userId,
      actorName: access.actor.name,
      reason,
    })
  },
})
