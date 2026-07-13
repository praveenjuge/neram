import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import { internalMutation } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import {
  addTaskToSprint,
  ensureSettings,
  MAX_SPRINT_TASKS,
  upcomingSprints,
} from "./sprintModel"

const BATCH_SIZE = 100

type StartRolloverArgs = {
  organizationId: string
  early: boolean
  actorUserId?: string
  actorName?: string
  reason?: string
  now?: number
}

async function assertRolloverCapacity(
  ctx: MutationCtx,
  args: {
    organizationId: string
    closingSprintId: Doc<"sprints">["_id"]
    promotedSprintId?: Doc<"sprints">["_id"]
    cutoffAt: number
  }
) {
  // With nothing scheduled after the active Sprint, unfinished work returns to
  // the Backlog, so there is no target to overflow.
  if (!args.promotedSprintId) return
  const promotedSprintId = args.promotedSprintId
  const [planned, current] = await Promise.all([
    ctx.db
      .query("sprintTaskEntries")
      .withIndex("by_sprint_and_removed", (q) =>
        q.eq("sprintId", promotedSprintId).eq("removedAt", undefined)
      )
      .take(MAX_SPRINT_TASKS + 1),
    ctx.db
      .query("tasks")
      .withIndex("by_organization_and_current_sprint", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("currentSprintId", args.closingSprintId)
      )
      .take(MAX_SPRINT_TASKS + 1),
  ])
  const carriedCount = current.filter(
    (task) => task.completedAt === undefined || task.completedAt > args.cutoffAt
  ).length
  const overflow = planned.length + carriedCount - MAX_SPRINT_TASKS
  if (overflow > 0) {
    throw new ConvexError({
      code: "SPRINT_ROLLOVER_CAPACITY",
      message: `Move at least ${overflow} task${overflow === 1 ? "" : "s"} from Upcoming to Backlog before rollover.`,
    })
  }
}

export async function startRollover(ctx: MutationCtx, args: StartRolloverArgs) {
  const now = args.now ?? Date.now()
  const settings = await ensureSettings(ctx, args.organizationId, now)
  if (settings.rolloverStatus === "running" && settings.activeRolloverJobId) {
    await ctx.scheduler.runAfter(0, internal.sprintRollover.process, {
      jobId: settings.activeRolloverJobId,
    })
    return settings.activeRolloverJobId
  }
  if (!settings.currentSprintId) {
    throw new ConvexError({
      code: "SPRINT_STATE_INVALID",
      message: "No active Sprint to roll over.",
    })
  }
  const closing = await ctx.db.get(settings.currentSprintId)
  if (!closing || closing.state !== "current") {
    throw new ConvexError({
      code: "SPRINT_STATE_INVALID",
      message: "Sprint state needs repair.",
    })
  }
  if (!args.early && now < closing.endsAt) {
    throw new ConvexError({
      code: "SPRINT_NOT_ENDED",
      message: "The current Sprint has not ended.",
    })
  }
  const cutoffAt = args.early ? now : closing.endsAt
  // Promote the soonest scheduled Sprint, if any; otherwise the Sprint just
  // closes and the workspace is left with no active Sprint.
  const promoted = (await upcomingSprints(ctx, args.organizationId))[0]
  await assertRolloverCapacity(ctx, {
    organizationId: args.organizationId,
    closingSprintId: closing._id,
    promotedSprintId: promoted?._id,
    cutoffAt,
  })
  const jobId = await ctx.db.insert("sprintRolloverJobs", {
    organizationId: args.organizationId,
    closingSprintId: closing._id,
    promotedSprintId: promoted?._id,
    status: "running",
    phase: "close_current",
    cutoffAt,
    early: args.early,
    actorUserId: args.actorUserId,
    actorName: args.actorName,
    reason: args.reason,
    baselineCount: 0,
    completedCount: 0,
    carriedCount: 0,
    addedCount: 0,
    removedCount: 0,
    reopenedCount: 0,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.patch(settings._id, {
    rolloverStatus: "running",
    activeRolloverJobId: jobId,
    updatedAt: now,
  })
  await ctx.scheduler.runAfter(0, internal.sprintRollover.process, { jobId })
  return jobId
}

async function closeCurrentBatch(
  ctx: MutationCtx,
  job: Doc<"sprintRolloverJobs">
) {
  const page = await ctx.db
    .query("sprintTaskEntries")
    .withIndex("by_sprint_and_added_at", (q) =>
      q.eq("sprintId", job.closingSprintId)
    )
    .paginate({ numItems: BATCH_SIZE, cursor: job.cursor ?? null })
  const syntheticActor = {
    subject: job.actorUserId ?? "system",
    userId: job.actorUserId ?? "system",
    name: job.actorName ?? "Neram",
    organizationId: job.organizationId,
  }
  let carriedCount = 0
  for (const entry of page.page) {
    if (entry.removedAt !== undefined) continue
    const task = await ctx.db.get(entry.taskId)
    if (!task || task.currentSprintId !== job.closingSprintId) continue
    const completedInClosing =
      entry.creditedCompletionAt !== undefined &&
      entry.creditedCompletionAt <= job.cutoffAt
    if (completedInClosing) {
      await ctx.db.patch(task._id, { currentSprintId: undefined })
      continue
    }
    // Unfinished work carries into the promoted Sprint, or returns to the
    // Backlog when nothing is scheduled next.
    if (!job.promotedSprintId) {
      await ctx.db.patch(task._id, { currentSprintId: undefined })
      continue
    }
    const project = await ctx.db.get(task.projectId)
    if (!project) continue
    await addTaskToSprint(ctx, {
      task: { ...task, currentSprintId: undefined },
      project,
      sprintId: job.promotedSprintId,
      actor: syntheticActor,
      origin: "carried",
      now: job.cutoffAt,
    })
    await ctx.db.patch(entry._id, { carriedToSprintId: job.promotedSprintId })
    carriedCount += 1
  }
  const baselineCount = page.page.filter(
    (entry) => entry.origin === "planned" || entry.origin === "carried"
  ).length
  const completedCount = page.page.filter(
    (entry) =>
      entry.creditedCompletionAt !== undefined &&
      entry.creditedCompletionAt <= job.cutoffAt
  ).length
  const addedCount = page.page.filter(
    (entry) => entry.origin === "scope_added"
  ).length
  const removedCount = page.page.filter(
    (entry) => entry.removedAt !== undefined
  ).length
  const reopenedCount = page.page.filter(
    (entry) => entry.origin === "reopened"
  ).length
  await ctx.db.patch(job._id, {
    baselineCount: job.baselineCount + baselineCount,
    completedCount: job.completedCount + completedCount,
    carriedCount: job.carriedCount + carriedCount,
    addedCount: job.addedCount + addedCount,
    removedCount: job.removedCount + removedCount,
    reopenedCount: job.reopenedCount + reopenedCount,
    cursor: page.isDone ? undefined : page.continueCursor,
    phase: page.isDone ? "promote_upcoming" : "close_current",
    updatedAt: Date.now(),
  })
  return page.isDone
}

async function promoteUpcomingBatch(
  ctx: MutationCtx,
  job: Doc<"sprintRolloverJobs">
) {
  // Nothing scheduled to promote: skip straight to finalize.
  if (!job.promotedSprintId) {
    await ctx.db.patch(job._id, {
      cursor: undefined,
      phase: "finalize",
      updatedAt: Date.now(),
    })
    return true
  }
  const promotedSprintId = job.promotedSprintId
  const page = await ctx.db
    .query("sprintTaskEntries")
    .withIndex("by_sprint_and_added_at", (q) =>
      q.eq("sprintId", promotedSprintId)
    )
    .paginate({ numItems: BATCH_SIZE, cursor: job.cursor ?? null })
  for (const entry of page.page) {
    if (entry.removedAt !== undefined) continue
    const task = await ctx.db.get(entry.taskId)
    if (!task || task.organizationId !== job.organizationId) continue
    const patch: Partial<Doc<"tasks">> = {
      currentSprintId: promotedSprintId,
      upcomingSprintId: undefined,
    }
    if (task.completedAt !== undefined && task.completedAt > job.cutoffAt) {
      await ctx.db.patch(entry._id, { creditedCompletionAt: task.completedAt })
    }
    await ctx.db.patch(task._id, patch)
  }
  await ctx.db.patch(job._id, {
    cursor: page.isDone ? undefined : page.continueCursor,
    phase: page.isDone ? "finalize" : "promote_upcoming",
    updatedAt: Date.now(),
  })
  return page.isDone
}

async function finalize(ctx: MutationCtx, job: Doc<"sprintRolloverJobs">) {
  const settings = await ctx.db
    .query("organizationSettings")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", job.organizationId)
    )
    .unique()
  const closing = await ctx.db.get(job.closingSprintId)
  if (!settings || !closing) {
    throw new Error("Sprint rollover references are missing")
  }
  if (closing.state === "closed") {
    // Already finalized (idempotent replay).
    await ctx.db.patch(job._id, {
      status: "completed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    })
    return
  }
  const promoted = job.promotedSprintId
    ? await ctx.db.get(job.promotedSprintId)
    : null
  const counts = {
    baselineCount: job.baselineCount,
    completedCount: job.completedCount,
    carriedCount: job.carriedCount,
    addedCount: job.addedCount,
    removedCount: job.removedCount,
    reopenedCount: job.reopenedCount,
  }
  const now = Date.now()
  await ctx.db.patch(closing._id, {
    state: "closed",
    closedCutoffAt: job.cutoffAt,
    closedAt: now,
    earlyCloseActorUserId: job.early ? job.actorUserId : undefined,
    earlyCloseActorName: job.early ? job.actorName : undefined,
    earlyCloseReason: job.early ? job.reason : undefined,
    ...counts,
    updatedAt: now,
  })
  let currentSprintId: Id<"sprints"> | undefined
  let upcomingSprintId: Id<"sprints"> | undefined
  if (promoted) {
    await ctx.db.patch(promoted._id, {
      state: "current",
      startsAt: job.cutoffAt,
      updatedAt: now,
    })
    currentSprintId = promoted._id
    // The next-soonest scheduled Sprint becomes the new Upcoming pointer.
    const remaining = await upcomingSprints(ctx, job.organizationId)
    upcomingSprintId = remaining[0]?._id
  }
  await ctx.db.patch(settings._id, {
    currentSprintId,
    upcomingSprintId,
    rolloverStatus: "idle",
    activeRolloverJobId: undefined,
    updatedAt: now,
  })
  await ctx.db.patch(job._id, {
    ...counts,
    status: "completed",
    completedAt: now,
    updatedAt: now,
  })
  await ctx.db.insert("organizationActivity", {
    organizationId: job.organizationId,
    actorUserId: job.actorUserId ?? "system",
    actorName: job.actorName ?? "Neram",
    type: job.early ? "sprint.early_closed" : "sprint.rolled_over",
    sprintId: closing._id,
    sprintNumber: closing.number,
    detail: job.reason,
    createdAt: now,
  })
  if (promoted) {
    await ctx.scheduler.runAt(
      promoted.endsAt,
      internal.sprintRollover.scheduled,
      {
        organizationId: job.organizationId,
        sprintId: promoted._id,
      }
    )
  }
}

export const process = internalMutation({
  args: { jobId: v.id("sprintRolloverJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.status !== "running") return null
    if (job.phase === "close_current") await closeCurrentBatch(ctx, job)
    else if (job.phase === "promote_upcoming")
      await promoteUpcomingBatch(ctx, job)
    else await finalize(ctx, job)
    const updated = await ctx.db.get(job._id)
    if (updated?.status === "running") {
      await ctx.scheduler.runAfter(0, internal.sprintRollover.process, {
        jobId: job._id,
      })
    }
    return null
  },
})

export const scheduled = internalMutation({
  args: { organizationId: v.string(), sprintId: v.id("sprints") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .unique()
    const sprint = await ctx.db.get(args.sprintId)
    if (
      settings?.currentSprintId === args.sprintId &&
      sprint?.state === "current" &&
      sprint.endsAt <= now
    ) {
      await startRollover(ctx, {
        organizationId: args.organizationId,
        early: false,
        now,
      })
    }
    return null
  },
})

export const repair = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now()
    const overdue = await ctx.db
      .query("sprints")
      .withIndex("by_state_and_ends_at", (q) =>
        q.eq("state", "current").lte("endsAt", now)
      )
      .take(50)
    for (const sprint of overdue) {
      await startRollover(ctx, {
        organizationId: sprint.organizationId,
        early: false,
        now,
      })
    }
    const running = await ctx.db
      .query("sprintRolloverJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(50)
    for (const job of running) {
      await ctx.scheduler.runAfter(0, internal.sprintRollover.process, {
        jobId: job._id,
      })
    }
    return null
  },
})
