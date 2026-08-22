import { v } from "convex/values"

import { internalMutation } from "./_generated/server"

/**
 * One-time production data hygiene ahead of the legacy-field schema narrowing.
 * Run `npx convex run migrations:run --prod` after deploying this version. It
 * pins the effective Sprint duration on every settings row, clears the retired
 * cadence fields, strips the always-zero carried counters from rollover jobs,
 * and deletes any never-started upcoming Sprints the old model left behind.
 */
export const run = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for await (const settings of ctx.db.query("organizationSettings")) {
      const duration =
        settings.sprintDuration ??
        (settings.cadenceWeeks === 1 ||
        settings.cadenceWeeks === 2 ||
        settings.cadenceWeeks === 4
          ? settings.cadenceWeeks
          : 2)
      await ctx.db.patch(settings._id, {
        sprintDuration: duration,
        cadenceWeeks: undefined,
        startWeekday: undefined,
        timezone: undefined,
        upcomingSprintId: undefined,
      })
    }
    for await (const job of ctx.db.query("sprintRolloverJobs")) {
      if (job.carriedCount !== undefined) {
        await ctx.db.patch(job._id, { carriedCount: undefined })
      }
    }
    for await (const task of ctx.db.query("tasks")) {
      if (task.upcomingSprintId !== undefined) {
        await ctx.db.patch(task._id, { upcomingSprintId: undefined })
      }
    }
    const upcoming = await ctx.db
      .query("sprints")
      .withIndex("by_state_and_ends_at", (q) => q.eq("state", "upcoming"))
      .take(500)
    for (const sprint of upcoming) {
      const entries = await ctx.db
        .query("sprintTaskEntries")
        .withIndex("by_sprint_and_added_at", (q) => q.eq("sprintId", sprint._id))
        .take(2000)
      for (const entry of entries) await ctx.db.delete(entry._id)
      await ctx.db.delete(sprint._id)
    }
    return null
  },
})
