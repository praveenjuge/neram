import { Migrations } from "@convex-dev/migrations"

import { components, internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"
import schema from "./schema"
import {
  legacyActivityKey,
  legacyActivityRecipient,
} from "./tenancyMigrationModel"

export const migrations = new Migrations(components.migrations, {
  schema,
  internalMutation,
})

export const backfillProjects = migrations.define({
  table: "projects",
  migrateOne: async (ctx, project) => {
    if (project.organizationId) return
    const mapping = await ctx.db
      .query("tenancyProjectMappings")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .unique()
    if (!mapping?.organizationId)
      throw new Error(`Missing Organization mapping for ${project._id}`)
    return { organizationId: mapping.organizationId }
  },
})

export const backfillTasks = migrations.define({
  table: "tasks",
  migrateOne: async (ctx, task) => {
    if (task.organizationId) return
    const project = await ctx.db.get(task.projectId)
    if (!project?.organizationId)
      throw new Error(`Project ${task.projectId} is not migrated`)
    return {
      organizationId: project.organizationId,
      completedAt: task.status === "done" ? task.updatedAt : undefined,
    }
  },
})

export const normalizeTaskAssignees = migrations.define({
  table: "tasks",
  migrateOne: async (_ctx, task) => {
    if (!task.assigneeSubject?.includes("|")) return
    return { assigneeSubject: task.assigneeSubject.split("|").at(-1) }
  },
})

export const normalizeTaskComments = migrations.define({
  table: "taskComments",
  migrateOne: async (_ctx, comment) => ({
    authorSubject: comment.authorSubject.split("|").at(-1)!,
    mentions: comment.mentions.map((item) => ({
      ...item,
      subject: item.subject.split("|").at(-1)!,
    })),
  }),
})

export const backfillActivity = migrations.define({
  table: "activity",
  migrateOne: async (ctx, activity) => {
    const project = await ctx.db.get(activity.projectId)
    const mapping = project
      ? undefined
      : await ctx.db
          .query("tenancyProjectMappings")
          .withIndex("by_project", (q) => q.eq("projectId", activity.projectId))
          .unique()
    const organizationId = project?.organizationId ?? mapping?.organizationId
    if (!organizationId)
      throw new Error(`Project ${activity.projectId} is not migrated`)
    const recipientUserId = legacyActivityRecipient(activity)
    const legacyEventKey = legacyActivityKey(activity)
    const existing = await ctx.db
      .query("organizationActivity")
      .withIndex("by_legacy_event_key", (q) =>
        q.eq("legacyEventKey", legacyEventKey)
      )
      .unique()
    if (!existing) {
      await ctx.db.insert("organizationActivity", {
        organizationId,
        actorUserId:
          activity.actorSubject.split("|").at(-1) ?? activity.actorSubject,
        actorName: activity.actorName,
        recipientUserId,
        type: activity.type,
        projectId: activity.projectId,
        projectName: activity.projectName,
        taskTitle: activity.taskTitle,
        taskId: activity.taskId,
        commentId: activity.commentId,
        commentExcerpt: activity.commentExcerpt,
        toStatus: activity.toStatus,
        assigneeUserId: activity.assigneeSubject?.split("|").at(-1),
        assigneeName: activity.assigneeName,
        legacyEventKey,
        createdAt: activity.createdAt,
      })
    }
    return { organizationId }
  },
})

export const backfillWorkStates = migrations.define({
  table: "projectWorkStates",
  migrateOne: async (ctx, state) => {
    if (state.organizationId) return
    const project = await ctx.db.get(state.projectId)
    if (!project?.organizationId)
      throw new Error(`Project ${state.projectId} is not migrated`)
    return { organizationId: project.organizationId }
  },
})

export const revokeProjectInvites = migrations.define({
  table: "projectInvites",
  migrateOne: async (ctx, invite) => await ctx.db.delete(invite._id),
})

export const purgeProjectMembers = migrations.define({
  table: "projectMembers",
  migrateOne: async (ctx, member) => await ctx.db.delete(member._id),
})

export const purgeLegacyActivity = migrations.define({
  table: "activity",
  migrateOne: async (ctx, activity) => await ctx.db.delete(activity._id),
})

export const purgeWorkStates = migrations.define({
  table: "projectWorkStates",
  migrateOne: async (ctx, state) => await ctx.db.delete(state._id),
})

export const clearProjectOwners = migrations.define({
  table: "projects",
  migrateOne: async () => ({
    ownerSubject: undefined,
    ownerName: undefined,
  }),
})

export const clearTaskOwners = migrations.define({
  table: "tasks",
  migrateOne: async () => ({ ownerSubject: undefined }),
})

export const purgeTenancyCohortMembers = migrations.define({
  table: "tenancyMigrationCohortMembers",
  migrateOne: async (ctx, row) => await ctx.db.delete(row._id),
})

export const purgeTenancyProjectMappings = migrations.define({
  table: "tenancyProjectMappings",
  migrateOne: async (ctx, row) => await ctx.db.delete(row._id),
})

export const purgeTenancyCohorts = migrations.define({
  table: "tenancyMigrationCohorts",
  migrateOne: async (ctx, row) => await ctx.db.delete(row._id),
})

export const purgeTenancyRuns = migrations.define({
  table: "tenancyMigrationRuns",
  migrateOne: async (ctx, row) => await ctx.db.delete(row._id),
})

export const runBackfill = migrations.runner([
  internal.migrations.backfillProjects,
  internal.migrations.backfillTasks,
  internal.migrations.normalizeTaskAssignees,
  internal.migrations.backfillActivity,
  internal.migrations.backfillWorkStates,
  internal.migrations.normalizeTaskComments,
  internal.migrations.revokeProjectInvites,
])

export const runNarrowCleanup = migrations.runner([
  internal.migrations.purgeProjectMembers,
  internal.migrations.purgeLegacyActivity,
  internal.migrations.purgeWorkStates,
])

export const runCanonicalCleanup = migrations.runner([
  internal.migrations.purgeProjectMembers,
  internal.migrations.revokeProjectInvites,
  internal.migrations.purgeLegacyActivity,
  internal.migrations.purgeWorkStates,
  internal.migrations.clearProjectOwners,
  internal.migrations.clearTaskOwners,
  internal.migrations.purgeTenancyCohortMembers,
  internal.migrations.purgeTenancyProjectMappings,
  internal.migrations.purgeTenancyCohorts,
  internal.migrations.purgeTenancyRuns,
])
