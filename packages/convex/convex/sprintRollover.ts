import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { internalMutation } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { ensureSettings, getSettings } from "./sprintModel"

const BATCH_SIZE = 100

type StartCloseArgs = {
  organizationId: string
  early: boolean
  actorUserId?: string
  actorName?: string
  now?: number
}

/**
 * Close the one active Sprint. Work is never promoted or carried: every live
 * task placement is cleared, leaving the workspace ready for a fresh Sprint.
 */
export async function startSprintClose(ctx: MutationCtx, args: StartCloseArgs) {
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
      message: "No active Sprint to end.",
    })
  }
  const sprint = await ctx.db.get(settings.currentSprintId)
  if (!sprint || sprint.state !== "current") {
    throw new ConvexError({
      code: "SPRINT_STATE_INVALID",
      message: "Sprint state needs repair.",
    })
  }
  if (!args.early && (sprint.endsAt === undefined || now < sprint.endsAt)) {
    throw new ConvexError({
      code: "SPRINT_NOT_ENDED",
      message: "The current Sprint has not ended.",
    })
  }
  const cutoffAt = args.early ? now : sprint.endsAt!
  const jobId = await ctx.db.insert("sprintRolloverJobs", {
    organizationId: args.organizationId,
    closingSprintId: sprint._id,
    status: "running",
    phase: "close_current",
    cutoffAt,
    early: args.early,
    actorUserId: args.actorUserId,
    actorName: args.actorName,
    baselineCount: 0,
    completedCount: 0,
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

async function closeTasks(ctx: MutationCtx, job: Doc<"sprintRolloverJobs">) {
  const now = Date.now()
  const page = await ctx.db
    .query("sprintTaskEntries")
    .withIndex("by_sprint_and_added_at", (q) =>
      q.eq("sprintId", job.closingSprintId)
    )
    .paginate({ numItems: BATCH_SIZE, cursor: job.cursor ?? null })

  let committed = 0
  let completed = 0
  let added = 0
  let removed = 0
  let reopened = 0
  for (const entry of page.page) {
    if (entry.removedAt !== undefined) {
      removed += 1
      continue
    }
    committed += 1
    if (
      entry.creditedCompletionAt !== undefined &&
      entry.creditedCompletionAt <= job.cutoffAt
    ) {
      completed += 1
    }
    if (entry.origin === "scope_added") added += 1
    if (entry.origin === "reopened") reopened += 1
    const task = await ctx.db.get(entry.taskId)
    if (task?.currentSprintId === job.closingSprintId) {
      await ctx.db.patch(task._id, {
        currentSprintId: undefined,
        upcomingSprintId: undefined,
        updatedAt: now,
      })
    }
  }
  await ctx.db.patch(job._id, {
    baselineCount: job.baselineCount + committed,
    completedCount: job.completedCount + completed,
    addedCount: job.addedCount + added,
    removedCount: job.removedCount + removed,
    reopenedCount: job.reopenedCount + reopened,
    cursor: page.isDone ? undefined : page.continueCursor,
    phase: page.isDone ? "finalize" : "close_current",
    updatedAt: now,
  })
}

async function finalize(ctx: MutationCtx, job: Doc<"sprintRolloverJobs">) {
  const settings = await getSettings(ctx, job.organizationId)
  const sprint = await ctx.db.get(job.closingSprintId)
  if (!settings || !sprint)
    throw new Error("Sprint close references are missing")
  const now = Date.now()
  if (sprint.state !== "closed") {
    await ctx.db.patch(sprint._id, {
      state: "closed",
      closedCutoffAt: job.cutoffAt,
      closedAt: now,
      baselineCount: job.baselineCount,
      completedCount: job.completedCount,
      addedCount: job.addedCount,
      removedCount: job.removedCount,
      reopenedCount: job.reopenedCount,
      updatedAt: now,
    })
    await ctx.db.insert("organizationActivity", {
      organizationId: job.organizationId,
      actorUserId: job.actorUserId ?? "system",
      actorName: job.actorName ?? "Neram",
      type: "sprint.ended",
      sprintId: sprint._id,
      sprintNumber: sprint.number,
      createdAt: now,
    })
  }
  await ctx.db.patch(settings._id, {
    currentSprintId: undefined,
    upcomingSprintId: undefined,
    rolloverStatus: "idle",
    activeRolloverJobId: undefined,
    updatedAt: now,
  })
  await ctx.db.patch(job._id, {
    status: "completed",
    completedAt: now,
    updatedAt: now,
  })
}

export const process = internalMutation({
  args: { jobId: v.id("sprintRolloverJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.status !== "running") return null
    if (job.phase === "close_current") await closeTasks(ctx, job)
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
    const settings = await getSettings(ctx, args.organizationId)
    const sprint = await ctx.db.get(args.sprintId)
    if (
      settings?.currentSprintId === args.sprintId &&
      sprint?.state === "current" &&
      sprint.endsAt !== undefined &&
      sprint.endsAt <= now
    ) {
      await startSprintClose(ctx, {
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
      if (sprint.endsAt !== undefined) {
        await startSprintClose(ctx, {
          organizationId: sprint.organizationId,
          early: false,
          now,
        })
      }
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
