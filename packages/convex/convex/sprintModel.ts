import { ConvexError } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import type { Actor } from "./model"
import { initialSprintBounds, nextSprintBounds } from "./sprintTime"

export const MAX_SPRINT_TASKS = 1000

export function cleanGoal(goal?: string) {
  if (goal === undefined) return undefined
  const value = goal.trim()
  if (!value) return undefined
  if (value.length > 500) {
    throw new ConvexError({
      code: "INVALID_GOAL",
      message: "Sprint goal must be at most 500 characters.",
    })
  }
  return value
}

export async function ensureSprintPair(
  ctx: MutationCtx,
  organizationId: string,
  now = Date.now()
) {
  const existing = await ctx.db
    .query("organizationSettings")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique()
  if (existing?.currentSprintId && existing.upcomingSprintId) return existing

  const cadence = existing ?? {
    cadenceWeeks: 2,
    startWeekday: 1,
    timezone: "UTC",
  }
  const currentBounds = initialSprintBounds(now, cadence)
  const currentNumber = existing?.nextSprintNumber ?? 1
  const currentSprintId = await ctx.db.insert("sprints", {
    organizationId,
    number: currentNumber,
    state: "current",
    ...currentBounds,
    createdAt: now,
    updatedAt: now,
  })
  const upcomingBounds = nextSprintBounds(currentBounds.endsAt, cadence)
  const upcomingSprintId = await ctx.db.insert("sprints", {
    organizationId,
    number: currentNumber + 1,
    state: "upcoming",
    ...upcomingBounds,
    createdAt: now,
    updatedAt: now,
  })
  if (existing) {
    await ctx.db.patch(existing._id, {
      currentSprintId,
      upcomingSprintId,
      nextSprintNumber: currentNumber + 2,
      rolloverStatus: "idle",
      updatedAt: now,
    })
  } else {
    await ctx.db.insert("organizationSettings", {
      organizationId,
      cadenceWeeks: cadence.cadenceWeeks,
      startWeekday: cadence.startWeekday,
      timezone: cadence.timezone,
      nextSprintNumber: currentNumber + 2,
      currentSprintId,
      upcomingSprintId,
      rolloverStatus: "idle",
      createdAt: now,
      updatedAt: now,
    })
  }
  return (await ctx.db
    .query("organizationSettings")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique())!
}

async function activeEntry(
  ctx: MutationCtx,
  sprintId: Id<"sprints">,
  taskId: Id<"tasks">
) {
  const entries = await ctx.db
    .query("sprintTaskEntries")
    .withIndex("by_sprint_task_and_removed", (q) =>
      q.eq("sprintId", sprintId).eq("taskId", taskId).eq("removedAt", undefined)
    )
    .unique()
  return entries
}

async function assertCapacity(ctx: MutationCtx, sprintId: Id<"sprints">) {
  const tasks = await ctx.db
    .query("sprintTaskEntries")
    .withIndex("by_sprint_and_added_at", (q) => q.eq("sprintId", sprintId))
    .take(MAX_SPRINT_TASKS + 1)
  if (tasks.length >= MAX_SPRINT_TASKS) {
    throw new ConvexError({
      code: "SPRINT_TASK_LIMIT",
      message: "A Sprint can contain at most 1,000 tasks.",
    })
  }
}

export async function addTaskToSprint(
  ctx: MutationCtx,
  args: {
    task: Doc<"tasks">
    project: Doc<"projects">
    sprintId: Id<"sprints">
    actor: Actor
    origin: Doc<"sprintTaskEntries">["origin"]
    priorCompletionSprintId?: Id<"sprints">
    now?: number
  }
) {
  const sprint = await ctx.db.get(args.sprintId)
  if (
    !sprint ||
    sprint.organizationId !== args.task.organizationId ||
    sprint.state === "closed"
  ) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Sprint not found." })
  }
  if (await activeEntry(ctx, sprint._id, args.task._id)) return sprint
  await assertCapacity(ctx, sprint._id)
  const now = args.now ?? Date.now()
  await ctx.db.insert("sprintTaskEntries", {
    organizationId: sprint.organizationId,
    sprintId: sprint._id,
    taskId: args.task._id,
    projectId: args.project._id,
    projectNameSnapshot: args.project.name,
    taskTitleSnapshot: args.task.title,
    origin: args.origin,
    actorUserId: args.actor.userId,
    actorName: args.actor.name,
    addedAt: now,
    priorCompletionSprintId: args.priorCompletionSprintId,
  })
  await ctx.db.patch(args.task._id, {
    currentSprintId: sprint.state === "current" ? sprint._id : undefined,
    upcomingSprintId: sprint.state === "upcoming" ? sprint._id : undefined,
    updatedAt: now,
  })
  return sprint
}

export async function removeTaskFromSprint(
  ctx: MutationCtx,
  args: {
    task: Doc<"tasks">
    sprintId: Id<"sprints">
    actor: Actor
    reason: string
    now?: number
  }
) {
  const entry = await activeEntry(ctx, args.sprintId, args.task._id)
  if (!entry) return
  const now = args.now ?? Date.now()
  await ctx.db.patch(entry._id, {
    removedAt: now,
    removedByUserId: args.actor.userId,
    removedByName: args.actor.name,
    removalReason: args.reason,
  })
  await ctx.db.patch(args.task._id, {
    currentSprintId:
      args.task.currentSprintId === args.sprintId
        ? undefined
        : args.task.currentSprintId,
    upcomingSprintId:
      args.task.upcomingSprintId === args.sprintId
        ? undefined
        : args.task.upcomingSprintId,
    updatedAt: now,
  })
}

async function latestCreditedSprint(ctx: MutationCtx, task: Doc<"tasks">) {
  const entries = await ctx.db
    .query("sprintTaskEntries")
    .withIndex("by_organization_task_and_completion", (q) =>
      q
        .eq("organizationId", task.organizationId as string)
        .eq("taskId", task._id)
        .gt("creditedCompletionAt", 0)
    )
    .order("desc")
    .first()
  return entries?.sprintId
}

export async function applyStatusSprintRules(
  ctx: MutationCtx,
  args: {
    task: Doc<"tasks">
    project: Doc<"projects">
    actor: Actor
    nextStatus: Doc<"tasks">["status"]
    now: number
  }
) {
  const { task, project, actor, nextStatus, now } = args
  if (!task.organizationId || task.status === nextStatus) return {}
  const settings = await ensureSprintPair(ctx, task.organizationId, now)
  const currentSprintId = settings.currentSprintId!

  if (task.status === "done" && nextStatus !== "done") {
    const priorCompletionSprintId = await latestCreditedSprint(ctx, task)
    if (!task.currentSprintId) {
      await addTaskToSprint(ctx, {
        task,
        project,
        sprintId: currentSprintId,
        actor,
        origin: "reopened",
        priorCompletionSprintId,
        now,
      })
    }
    const entry = await activeEntry(ctx, currentSprintId, task._id)
    if (entry)
      await ctx.db.patch(entry._id, { creditedCompletionAt: undefined })
    return { completedAt: undefined, currentSprintId }
  }

  if (nextStatus === "inProgress" || nextStatus === "done") {
    if (task.upcomingSprintId) {
      await removeTaskFromSprint(ctx, {
        task,
        sprintId: task.upcomingSprintId,
        actor,
        reason: "started_early",
        now,
      })
    }
    if (!task.currentSprintId) {
      await addTaskToSprint(ctx, {
        task: { ...task, upcomingSprintId: undefined },
        project,
        sprintId: currentSprintId,
        actor,
        origin: "scope_added",
        now,
      })
    }
  }

  if (nextStatus === "done") {
    const entry = await activeEntry(ctx, currentSprintId, task._id)
    if (entry) await ctx.db.patch(entry._id, { creditedCompletionAt: now })
    return { completedAt: now, currentSprintId }
  }
  return task.upcomingSprintId
    ? { upcomingSprintId: undefined, currentSprintId }
    : {}
}

export async function markTaskEntriesRemoved(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actor: Actor,
  reason: string
) {
  if (task.currentSprintId) {
    await removeTaskFromSprint(ctx, {
      task,
      sprintId: task.currentSprintId,
      actor,
      reason,
    })
  }
  if (task.upcomingSprintId) {
    await removeTaskFromSprint(ctx, {
      task,
      sprintId: task.upcomingSprintId,
      actor,
      reason,
    })
  }
}
