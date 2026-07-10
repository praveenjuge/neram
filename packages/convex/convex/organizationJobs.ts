import { v } from "convex/values"

import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { internalMutation, internalQuery } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"

const BATCH_SIZE = 100

export const running = internalQuery({
  args: {
    organizationId: v.string(),
    kind: v.union(v.literal("member_cleanup"), v.literal("workspace_deletion")),
  },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("organizationJobs")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "running")
      )
      .take(20)
    return jobs.find((job) => job.kind === args.kind) ?? null
  },
})

export const cleanupMember = internalMutation({
  args: { jobId: v.id("organizationJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (
      !job ||
      job.kind !== "member_cleanup" ||
      job.status !== "running" ||
      !job.targetUserId
    ) {
      return null
    }
    const page = await ctx.db
      .query("tasks")
      .withIndex("by_organization_and_updated_at", (q) =>
        q.eq("organizationId", job.organizationId)
      )
      .paginate({ numItems: BATCH_SIZE, cursor: job.cursor ?? null })
    for (const task of page.page) {
      if (task.status !== "done" && task.assigneeSubject === job.targetUserId) {
        await ctx.db.patch(task._id, {
          assigneeSubject: undefined,
          assigneeName: undefined,
          updatedAt: Date.now(),
        })
      }
    }
    const now = Date.now()
    if (page.isDone) {
      await ctx.db.patch(job._id, {
        status: "completed",
        completedAt: now,
        cursor: undefined,
        updatedAt: now,
      })
    } else {
      await ctx.db.patch(job._id, {
        cursor: page.continueCursor,
        updatedAt: now,
      })
      await ctx.scheduler.runAfter(0, internal.organizationJobs.cleanupMember, {
        jobId: job._id,
      })
    }
    return null
  },
})

async function advance(
  ctx: MutationCtx,
  jobId: Id<"organizationJobs">,
  phase: string
) {
  await ctx.db.patch(jobId, { phase, updatedAt: Date.now() })
  await ctx.scheduler.runAfter(0, internal.organizationJobs.purgeWorkspace, {
    jobId,
  })
}

export const purgeWorkspace = internalMutation({
  args: { jobId: v.id("organizationJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.kind !== "workspace_deletion" || job.status !== "running")
      return null

    if (job.phase === "organizationActivity") {
      const rows = await ctx.db
        .query("organizationActivity")
        .withIndex("by_organization_and_created_at", (q) =>
          q.eq("organizationId", job.organizationId)
        )
        .take(BATCH_SIZE)
      for (const row of rows) await ctx.db.delete(row._id)
      if (rows.length === BATCH_SIZE) return await reschedule(ctx, job._id)
      await advance(ctx, job._id, "activity")
      return null
    }
    if (job.phase === "activity") {
      const rows = await ctx.db
        .query("activity")
        .withIndex("by_organization_and_created_at", (q) =>
          q.eq("organizationId", job.organizationId)
        )
        .take(BATCH_SIZE)
      for (const row of rows) await ctx.db.delete(row._id)
      if (rows.length === BATCH_SIZE) return await reschedule(ctx, job._id)
      await advance(ctx, job._id, "sprintEntries")
      return null
    }
    if (job.phase === "sprintEntries") {
      const rows = await ctx.db
        .query("sprintTaskEntries")
        .withIndex("by_organization_and_task", (q) =>
          q.eq("organizationId", job.organizationId)
        )
        .take(BATCH_SIZE)
      for (const row of rows) await ctx.db.delete(row._id)
      if (rows.length === BATCH_SIZE) return await reschedule(ctx, job._id)
      await advance(ctx, job._id, "tasks")
      return null
    }
    if (job.phase === "tasks") {
      const rows = await ctx.db
        .query("tasks")
        .withIndex("by_organization_and_updated_at", (q) =>
          q.eq("organizationId", job.organizationId)
        )
        .take(20)
      for (const row of rows) {
        const [subtasks, comments, stats] = await Promise.all([
          ctx.db
            .query("subtasks")
            .withIndex("by_task_position", (q) => q.eq("taskId", row._id))
            .take(BATCH_SIZE),
          ctx.db
            .query("taskComments")
            .withIndex("by_task_and_created", (q) => q.eq("taskId", row._id))
            .take(BATCH_SIZE),
          ctx.db
            .query("taskStats")
            .withIndex("by_task", (q) => q.eq("taskId", row._id))
            .unique(),
        ])
        for (const subtask of subtasks) await ctx.db.delete(subtask._id)
        for (const comment of comments) await ctx.db.delete(comment._id)
        if (
          subtasks.length === BATCH_SIZE ||
          comments.length === BATCH_SIZE
        ) {
          return await reschedule(ctx, job._id)
        }
        if (stats) await ctx.db.delete(stats._id)
        await ctx.db.delete(row._id)
      }
      if (rows.length === 20) return await reschedule(ctx, job._id)
      await advance(ctx, job._id, "projects")
      return null
    }
    if (job.phase === "projects") {
      const rows = await ctx.db
        .query("projects")
        .withIndex("by_organization_archived_updated", (q) =>
          q.eq("organizationId", job.organizationId)
        )
        .take(20)
      for (const project of rows) {
        const members = await ctx.db
          .query("projectMembers")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .take(BATCH_SIZE)
        for (const member of members) await ctx.db.delete(member._id)
        const invites = await ctx.db
          .query("projectInvites")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .take(BATCH_SIZE)
        for (const invite of invites) await ctx.db.delete(invite._id)
        if (members.length === BATCH_SIZE || invites.length === BATCH_SIZE) {
          return await reschedule(ctx, job._id)
        }
        await ctx.db.delete(project._id)
      }
      if (rows.length === 20) return await reschedule(ctx, job._id)
      await advance(ctx, job._id, "sprintJobs")
      return null
    }
    if (job.phase === "sprintJobs") {
      const rows = await ctx.db
        .query("sprintRolloverJobs")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", job.organizationId)
        )
        .take(BATCH_SIZE)
      for (const row of rows) await ctx.db.delete(row._id)
      if (rows.length === BATCH_SIZE) return await reschedule(ctx, job._id)
      await advance(ctx, job._id, "sprints")
      return null
    }
    if (job.phase === "sprints") {
      const rows = await ctx.db
        .query("sprints")
        .withIndex("by_organization_and_state", (q) =>
          q.eq("organizationId", job.organizationId)
        )
        .take(BATCH_SIZE)
      for (const row of rows) await ctx.db.delete(row._id)
      if (rows.length === BATCH_SIZE) return await reschedule(ctx, job._id)
      await advance(ctx, job._id, "settings")
      return null
    }
    if (job.phase === "settings") {
      const row = await ctx.db
        .query("organizationSettings")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", job.organizationId)
        )
        .unique()
      if (row) await ctx.db.delete(row._id)
      await advance(ctx, job._id, "workStates")
      return null
    }
    if (job.phase === "workStates") {
      const rows = await ctx.db
        .query("projectWorkStates")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", job.organizationId)
        )
        .take(BATCH_SIZE)
      for (const row of rows) await ctx.db.delete(row._id)
      if (rows.length === BATCH_SIZE) return await reschedule(ctx, job._id)
      await advance(ctx, job._id, "members")
      return null
    }
    if (job.phase === "members") {
      const rows = await ctx.db
        .query("organizationMembers")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", job.organizationId)
        )
        .take(BATCH_SIZE)
      for (const row of rows) await ctx.db.delete(row._id)
      if (rows.length === BATCH_SIZE) return await reschedule(ctx, job._id)
      await advance(ctx, job._id, "jobs")
      return null
    }
    if (job.phase === "jobs") {
      const rows = await ctx.db
        .query("organizationJobs")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", job.organizationId)
        )
        .take(BATCH_SIZE)
      for (const row of rows)
        if (row._id !== job._id) await ctx.db.delete(row._id)
      if (rows.length === BATCH_SIZE) return await reschedule(ctx, job._id)
      await ctx.db.patch(job._id, { phase: "clerk", updatedAt: Date.now() })
      if (job.externalDeletion) {
        await ctx.scheduler.runAfter(
          0,
          internal.organizationJobs.finishWorkspaceDeletion,
          {
            jobId: job._id,
            organizationId: job.organizationId,
          }
        )
        return null
      }
      await ctx.scheduler.runAfter(
        0,
        internal.organizationActions.deleteClerkOrganization,
        {
          jobId: job._id,
          organizationId: job.organizationId,
        }
      )
      return null
    }
    return null
  },
})

async function reschedule(ctx: MutationCtx, jobId: Id<"organizationJobs">) {
  await ctx.scheduler.runAfter(0, internal.organizationJobs.purgeWorkspace, {
    jobId,
  })
  return null
}

export const finishWorkspaceDeletion = internalMutation({
  args: { jobId: v.id("organizationJobs"), organizationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .unique()
    if (organization) await ctx.db.delete(organization._id)
    const job = await ctx.db.get(args.jobId)
    if (job) await ctx.db.delete(job._id)
    return null
  },
})

export const failWorkspaceDeletion = internalMutation({
  args: { jobId: v.id("organizationJobs"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (job)
      await ctx.db.patch(job._id, {
        status: "failed",
        error: args.error,
        updatedAt: Date.now(),
      })
    return null
  },
})
