import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"

import { internalMutation, internalQuery } from "./_generated/server"

export const projectPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) =>
    await ctx.db.query("projects").paginate(args.paginationOpts),
})

export const taskPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) =>
    await ctx.db.query("tasks").paginate(args.paginationOpts),
})

export const activityPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) =>
    await ctx.db.query("activity").paginate(args.paginationOpts),
})

export const memberPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) =>
    await ctx.db.query("projectMembers").paginate(args.paginationOpts),
})

export const invitePage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) =>
    await ctx.db.query("projectInvites").paginate(args.paginationOpts),
})

export const workStatePage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) =>
    await ctx.db.query("projectWorkStates").paginate(args.paginationOpts),
})

export const subtaskPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) =>
    await ctx.db.query("subtasks").paginate(args.paginationOpts),
})

export const commentPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) =>
    await ctx.db.query("taskComments").paginate(args.paginationOpts),
})

export const taskStatsPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) =>
    await ctx.db.query("taskStats").paginate(args.paginationOpts),
})

export const organizationActivityPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) =>
    await ctx.db.query("organizationActivity").paginate(args.paginationOpts),
})

export const cohortState = internalQuery({
  args: { cohortKey: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("tenancyMigrationCohorts")
      .withIndex("by_cohort_key", (q) => q.eq("cohortKey", args.cohortKey))
      .unique(),
})

export const runState = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("tenancyMigrationRuns")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique(),
})

export const organizationProjection = internalQuery({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    const [organization, settings, members] = await Promise.all([
      ctx.db
        .query("organizations")
        .withIndex("by_organization_id", (q) =>
          q.eq("organizationId", args.organizationId)
        )
        .unique(),
      ctx.db
        .query("organizationSettings")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId)
        )
        .unique(),
      ctx.db
        .query("organizationMembers")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId)
        )
        .take(501),
    ])
    return { organization, settings, members }
  },
})

export const projectMapping = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("tenancyProjectMappings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique(),
})

const cohort = v.object({
  cohortKey: v.string(),
  ownerSubject: v.string(),
  ownerUserId: v.string(),
  ownerDisplayName: v.string(),
  ordinalForOwner: v.number(),
  projects: v.array(v.id("projects")),
  members: v.array(
    v.object({
      subject: v.string(),
      userId: v.string(),
      role: v.union(v.literal("org:admin"), v.literal("org:member")),
      displayName: v.string(),
    })
  ),
})

export const persistInventory = internalMutation({
  args: {
    key: v.string(),
    expectedProjects: v.number(),
    expectedTasks: v.number(),
    expectedActivityRows: v.number(),
    expectedLegacyMembers: v.number(),
    expectedLegacyInvites: v.number(),
    expectedLegacyWorkStates: v.number(),
    expectedSubtasks: v.number(),
    expectedComments: v.number(),
    expectedTaskStats: v.number(),
    orphanProjectMappings: v.array(
      v.object({
        projectId: v.id("projects"),
        cohortKey: v.string(),
      })
    ),
    cohorts: v.array(cohort),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const run = await ctx.db
      .query("tenancyMigrationRuns")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique()
    const runData = {
      phase: "inventoried" as const,
      expectedProjects: args.expectedProjects,
      expectedTasks: args.expectedTasks,
      expectedActivityRows: args.expectedActivityRows,
      expectedLegacyMembers: args.expectedLegacyMembers,
      expectedLegacyInvites: args.expectedLegacyInvites,
      expectedLegacyWorkStates: args.expectedLegacyWorkStates,
      expectedSubtasks: args.expectedSubtasks,
      expectedComments: args.expectedComments,
      expectedTaskStats: args.expectedTaskStats,
      expectedOrphanProjectMappings: args.orphanProjectMappings.length,
      expectedCohorts: args.cohorts.length,
      updatedAt: now,
    }
    if (run) await ctx.db.patch(run._id, runData)
    else
      await ctx.db.insert("tenancyMigrationRuns", {
        key: args.key,
        ...runData,
        createdAt: now,
      })

    for (const cohort of args.cohorts) {
      const existing = await ctx.db
        .query("tenancyMigrationCohorts")
        .withIndex("by_cohort_key", (q) => q.eq("cohortKey", cohort.cohortKey))
        .unique()
      if (existing) {
        await ctx.db.patch(existing._id, {
          ownerSubject: cohort.ownerSubject,
          ownerUserId: cohort.ownerUserId,
          ownerDisplayName: cohort.ownerDisplayName,
          ordinalForOwner: cohort.ordinalForOwner,
          updatedAt: now,
        })
      } else {
        await ctx.db.insert("tenancyMigrationCohorts", {
          cohortKey: cohort.cohortKey,
          ownerSubject: cohort.ownerSubject,
          ownerUserId: cohort.ownerUserId,
          ownerDisplayName: cohort.ownerDisplayName,
          ordinalForOwner: cohort.ordinalForOwner,
          createdAt: now,
          updatedAt: now,
        })
      }
      const oldMembers = await ctx.db
        .query("tenancyMigrationCohortMembers")
        .withIndex("by_cohort_key", (q) => q.eq("cohortKey", cohort.cohortKey))
        .take(500)
      for (const member of oldMembers) await ctx.db.delete(member._id)
      for (const member of cohort.members) {
        await ctx.db.insert("tenancyMigrationCohortMembers", {
          cohortKey: cohort.cohortKey,
          ...member,
          createdAt: now,
        })
      }
      for (const projectId of cohort.projects) {
        const mapping = await ctx.db
          .query("tenancyProjectMappings")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .unique()
        if (mapping)
          await ctx.db.patch(mapping._id, {
            cohortKey: cohort.cohortKey,
            updatedAt: now,
          })
        else {
          await ctx.db.insert("tenancyProjectMappings", {
            projectId,
            cohortKey: cohort.cohortKey,
            createdAt: now,
            updatedAt: now,
          })
        }
      }
    }
    for (const orphan of args.orphanProjectMappings) {
      const mapping = await ctx.db
        .query("tenancyProjectMappings")
        .withIndex("by_project", (q) => q.eq("projectId", orphan.projectId))
        .unique()
      if (mapping) {
        if (mapping.cohortKey !== orphan.cohortKey) {
          throw new Error(
            `Conflicting Organization cohorts for deleted project ${orphan.projectId}`
          )
        }
        await ctx.db.patch(mapping._id, { updatedAt: now })
      } else {
        await ctx.db.insert("tenancyProjectMappings", {
          projectId: orphan.projectId,
          cohortKey: orphan.cohortKey,
          createdAt: now,
          updatedAt: now,
        })
      }
    }
    return null
  },
})

export const recordProvisioned = internalMutation({
  args: {
    runKey: v.string(),
    cohortKey: v.string(),
    organizationId: v.string(),
    organizationSlug: v.string(),
    organizationName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cohort = await ctx.db
      .query("tenancyMigrationCohorts")
      .withIndex("by_cohort_key", (q) => q.eq("cohortKey", args.cohortKey))
      .unique()
    if (!cohort) throw new Error(`Missing cohort ${args.cohortKey}`)
    const now = Date.now()
    await ctx.db.patch(cohort._id, {
      organizationId: args.organizationId,
      organizationSlug: args.organizationSlug,
      organizationName: args.organizationName,
      provisionedAt: now,
      updatedAt: now,
    })
    const mappings = await ctx.db
      .query("tenancyProjectMappings")
      .withIndex("by_cohort_key", (q) => q.eq("cohortKey", args.cohortKey))
      .take(500)
    for (const mapping of mappings)
      await ctx.db.patch(mapping._id, {
        organizationId: args.organizationId,
        updatedAt: now,
      })
    const run = await ctx.db
      .query("tenancyMigrationRuns")
      .withIndex("by_key", (q) => q.eq("key", args.runKey))
      .unique()
    if (run)
      await ctx.db.patch(run._id, { phase: "provisioning", updatedAt: now })
    return null
  },
})

export const markRunPhase = internalMutation({
  args: {
    key: v.string(),
    phase: v.union(
      v.literal("inventoried"),
      v.literal("provisioning"),
      v.literal("provisioned"),
      v.literal("backfilled"),
      v.literal("verified"),
      v.literal("canonical")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("tenancyMigrationRuns")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique()
    if (!run) throw new Error(`Missing migration run ${args.key}`)
    const now = Date.now()
    await ctx.db.patch(run._id, {
      phase: args.phase,
      verifiedAt: args.phase === "verified" ? now : run.verifiedAt,
      updatedAt: now,
    })
    return null
  },
})
