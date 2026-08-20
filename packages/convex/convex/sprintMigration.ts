import { v } from "convex/values"

import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"

const BATCH_SIZE = 50

/**
 * Approved one-time cleanup for the retired Upcoming Sprint model.
 *
 * Run `npx convex run sprintMigration:begin` after deploying the compatible
 * schema. It returns future work to Backlog, deletes only never-started Sprint
 * schedules and their entries, and leaves current and closed history untouched.
 */
export const begin = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const sprint = await ctx.db
      .query("sprints")
      .withIndex("by_state_and_ends_at", (q) => q.eq("state", "upcoming"))
      .first()
    if (sprint) {
      await ctx.scheduler.runAfter(0, internal.sprintMigration.cleanupSprint, {
        sprintId: sprint._id,
      })
    }
    return null
  },
})

export const cleanupSprint = internalMutation({
  args: { sprintId: v.id("sprints") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId)
    if (!sprint || sprint.state !== "upcoming") {
      await ctx.scheduler.runAfter(0, internal.sprintMigration.begin, {})
      return null
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_organization_and_upcoming_sprint", (q) =>
        q
          .eq("organizationId", sprint.organizationId)
          .eq("upcomingSprintId", sprint._id)
      )
      .take(BATCH_SIZE)
    if (tasks.length > 0) {
      const now = Date.now()
      for (const task of tasks) {
        await ctx.db.patch(task._id, {
          upcomingSprintId: undefined,
          updatedAt: now,
        })
      }
      await ctx.scheduler.runAfter(0, internal.sprintMigration.cleanupSprint, {
        sprintId: sprint._id,
      })
      return null
    }

    const entries = await ctx.db
      .query("sprintTaskEntries")
      .withIndex("by_sprint_and_added_at", (q) => q.eq("sprintId", sprint._id))
      .take(BATCH_SIZE)
    if (entries.length > 0) {
      for (const entry of entries) await ctx.db.delete(entry._id)
      await ctx.scheduler.runAfter(0, internal.sprintMigration.cleanupSprint, {
        sprintId: sprint._id,
      })
      return null
    }

    const settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", sprint.organizationId)
      )
      .unique()
    if (settings?.upcomingSprintId === sprint._id) {
      await ctx.db.patch(settings._id, {
        upcomingSprintId: undefined,
        updatedAt: Date.now(),
      })
    }
    await ctx.db.delete(sprint._id)
    await ctx.scheduler.runAfter(0, internal.sprintMigration.begin, {})
    return null
  },
})
