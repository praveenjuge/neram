import { ConvexError } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Actor } from "./model"

export const MAX_SPRINT_TASKS = 1000
type SprintActor = Pick<Actor, "userId" | "name">

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

export async function getSettings(
  ctx: MutationCtx | QueryCtx,
  organizationId: string
) {
  return await ctx.db
    .query("organizationSettings")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique()
}

export async function ensureSettings(
  ctx: MutationCtx,
  organizationId: string,
  now = Date.now()
) {
  const existing = await getSettings(ctx, organizationId)
  if (existing) return existing
  const id = await ctx.db.insert("organizationSettings", {
    organizationId,
    sprintDuration: 2,
    nextSprintNumber: 1,
    rolloverStatus: "idle",
    createdAt: now,
    updatedAt: now,
  })
  return (await ctx.db.get(id))!
}

export async function activeSprintId(
  ctx: MutationCtx,
  settings: Doc<"organizationSettings">
) {
  if (!settings.currentSprintId) return undefined
  const sprint = await ctx.db.get(settings.currentSprintId)
  return sprint?.state === "current" ? sprint._id : undefined
}

async function activeEntry(
  ctx: MutationCtx,
  sprintId: Id<"sprints">,
  taskId: Id<"tasks">
) {
  return await ctx.db
    .query("sprintTaskEntries")
    .withIndex("by_sprint_task_and_removed", (q) =>
      q.eq("sprintId", sprintId).eq("taskId", taskId).eq("removedAt", undefined)
    )
    .unique()
}

async function assertWritable(ctx: MutationCtx, organizationId: string) {
  const settings = await getSettings(ctx, organizationId)
  if (settings?.rolloverStatus === "running") {
    throw new ConvexError({
      code: "SPRINT_CLOSING",
      message: "Sprint changes are paused while it closes.",
    })
  }
}

async function assertCapacity(ctx: MutationCtx, sprintId: Id<"sprints">) {
  const entries = await ctx.db
    .query("sprintTaskEntries")
    .withIndex("by_sprint_and_removed", (q) =>
      q.eq("sprintId", sprintId).eq("removedAt", undefined)
    )
    .take(MAX_SPRINT_TASKS)
  if (entries.length >= MAX_SPRINT_TASKS) {
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
    actor: SprintActor
    origin: Doc<"sprintTaskEntries">["origin"]
    priorCompletionSprintId?: Id<"sprints">
    now?: number
  }
) {
  const sprint = await ctx.db.get(args.sprintId)
  if (
    !sprint ||
    sprint.organizationId !== args.task.organizationId ||
    sprint.state !== "current"
  ) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Sprint not found." })
  }
  if (await activeEntry(ctx, sprint._id, args.task._id)) return sprint
  await assertWritable(ctx, sprint.organizationId)
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
    currentSprintId: sprint._id,
    updatedAt: now,
  })
  return sprint
}

export async function removeTaskFromSprint(
  ctx: MutationCtx,
  args: {
    task: Doc<"tasks">
    sprintId: Id<"sprints">
    actor: SprintActor
    reason: string
    now?: number
  }
) {
  const entry = await activeEntry(ctx, args.sprintId, args.task._id)
  if (!entry) return
  await assertWritable(ctx, args.task.organizationId)
  const now = args.now ?? Date.now()
  await ctx.db.patch(entry._id, {
    removedAt: now,
    removedByUserId: args.actor.userId,
    removedByName: args.actor.name,
    removalReason: args.reason,
  })
  await ctx.db.patch(args.task._id, {
    currentSprintId: undefined,
    updatedAt: now,
  })
}

async function latestCreditedSprint(ctx: MutationCtx, task: Doc<"tasks">) {
  const entry = await ctx.db
    .query("sprintTaskEntries")
    .withIndex("by_organization_task_and_completion", (q) =>
      q
        .eq("organizationId", task.organizationId)
        .eq("taskId", task._id)
        .gt("creditedCompletionAt", 0)
    )
    .order("desc")
    .first()
  return entry?.sprintId
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
  if (task.status === nextStatus) return {}
  const settings = await ensureSettings(ctx, task.organizationId, now)
  const sprintId = await activeSprintId(ctx, settings)

  if (!sprintId) {
    if (nextStatus === "done") return { completedAt: now }
    if (task.status === "done") return { completedAt: undefined }
    return {}
  }

  if (task.status === "done" && nextStatus !== "done") {
    const priorCompletionSprintId = await latestCreditedSprint(ctx, task)
    if (!task.currentSprintId) {
      await addTaskToSprint(ctx, {
        task,
        project,
        sprintId,
        actor,
        origin: "reopened",
        priorCompletionSprintId,
        now,
      })
    }
    const entry = await activeEntry(ctx, sprintId, task._id)
    if (entry)
      await ctx.db.patch(entry._id, { creditedCompletionAt: undefined })
    return { completedAt: undefined, currentSprintId: sprintId }
  }

  if (
    (nextStatus === "inProgress" || nextStatus === "done") &&
    !task.currentSprintId
  ) {
    await addTaskToSprint(ctx, {
      task,
      project,
      sprintId,
      actor,
      origin: "scope_added",
      now,
    })
  }

  if (nextStatus === "done") {
    const entry = await activeEntry(ctx, sprintId, task._id)
    if (entry) await ctx.db.patch(entry._id, { creditedCompletionAt: now })
    return { completedAt: now, currentSprintId: sprintId }
  }
  return task.currentSprintId ? {} : { currentSprintId: sprintId }
}

export async function markTaskEntriesRemoved(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actor: SprintActor,
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
}
