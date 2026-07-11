import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"
import { actor, requireOrganization, requireOrganizationAdmin } from "./model"
import { ensureSprintPair } from "./sprintModel"

const role = v.union(v.literal("org:admin"), v.literal("org:member"))
const organization = v.object({
  _id: v.id("organizations"),
  _creationTime: v.number(),
  organizationId: v.string(),
  slug: v.string(),
  name: v.string(),
  state: v.union(v.literal("active"), v.literal("deleting")),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletingAt: v.optional(v.number()),
  deletedAt: v.optional(v.number()),
})
const member = v.object({
  _id: v.id("organizationMembers"),
  _creationTime: v.number(),
  organizationId: v.string(),
  membershipId: v.string(),
  userId: v.string(),
  role,
  displayName: v.string(),
  email: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
const settings = v.object({
  _id: v.id("organizationSettings"),
  _creationTime: v.number(),
  organizationId: v.string(),
  cadenceWeeks: v.number(),
  startWeekday: v.number(),
  timezone: v.string(),
  nextSprintNumber: v.number(),
  currentSprintId: v.optional(v.id("sprints")),
  upcomingSprintId: v.optional(v.id("sprints")),
  rolloverStatus: v.union(v.literal("idle"), v.literal("running")),
  activeRolloverJobId: v.optional(v.id("sprintRolloverJobs")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
const tokenContext = v.object({
  organizationId: v.string(),
  organizationSlug: v.string(),
  userId: v.string(),
  name: v.string(),
})

export const current = query({
  args: {},
  returns: v.object({
    organization,
    membership: member,
    settings: v.union(v.null(), settings),
  }),
  handler: async (ctx) => {
    const access = await requireOrganization(ctx)
    const settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", access.organization.organizationId)
      )
      .unique()
    return {
      organization: access.organization,
      membership: access.membership,
      settings,
    }
  },
})

export const members = query({
  args: {},
  returns: v.array(member),
  handler: async (ctx) => {
    const access = await requireOrganization(ctx)
    return await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", access.organization.organizationId)
      )
      .take(500)
  },
})

export const adminContext = internalQuery({
  args: {},
  returns: tokenContext,
  handler: async (ctx) => {
    const access = await requireOrganizationAdmin(ctx)
    return {
      organizationId: access.organization.organizationId,
      organizationSlug: access.organization.slug,
      userId: access.actor.userId,
      name: access.actor.name,
    }
  },
})

export const activeTokenContext = internalQuery({
  args: {},
  returns: tokenContext,
  handler: async (ctx) => {
    const who = await actor(ctx)
    if (!who.organizationId || !who.organizationSlug) {
      throw new ConvexError({
        code: "ORGANIZATION_REQUIRED",
        message: "Choose a workspace and sign in again.",
      })
    }
    return {
      organizationId: who.organizationId,
      organizationSlug: who.organizationSlug,
      userId: who.userId,
      name: who.name,
    }
  },
})

export const upsertOrganization = internalMutation({
  args: { organizationId: v.string(), slug: v.string(), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .unique()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        slug: args.slug,
        name: args.name,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert("organizations", {
        ...args,
        state: "active",
        createdAt: now,
        updatedAt: now,
      })
      const settings = await ensureSprintPair(ctx, args.organizationId, now)
      const currentSprint = await ctx.db.get(settings.currentSprintId!)
      if (currentSprint) {
        await ctx.scheduler.runAt(
          currentSprint.endsAt,
          internal.sprintRollover.scheduled,
          {
            organizationId: args.organizationId,
            sprintId: currentSprint._id,
          }
        )
      }
    }
    return null
  },
})

export const upsertMember = internalMutation({
  args: {
    organizationId: v.string(),
    membershipId: v.string(),
    userId: v.string(),
    role,
    displayName: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizationMembers")
      .withIndex("by_membership_id", (q) =>
        q.eq("membershipId", args.membershipId)
      )
      .unique()
    const duplicate = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .unique()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now })
    } else if (duplicate) {
      await ctx.db.patch(duplicate._id, { ...args, updatedAt: now })
    } else {
      await ctx.db.insert("organizationMembers", {
        ...args,
        createdAt: now,
        updatedAt: now,
      })
    }
    return null
  },
})

export const removeMemberProjection = internalMutation({
  args: { organizationId: v.string(), userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .unique()
    if (membership) await ctx.db.delete(membership._id)
    const now = Date.now()
    const jobId = await ctx.db.insert("organizationJobs", {
      organizationId: args.organizationId,
      kind: "member_cleanup",
      status: "running",
      phase: "tasks",
      targetUserId: args.userId,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.organizationJobs.cleanupMember, {
      jobId,
    })
    return null
  },
})

export const handleExternalDeletion = internalMutation({
  args: { organizationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .unique()
    if (!organization) return null
    const existing = await ctx.db
      .query("organizationJobs")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "running")
      )
      .take(20)
    if (existing.some((job) => job.kind === "workspace_deletion")) return null
    const now = Date.now()
    const jobId = await ctx.db.insert("organizationJobs", {
      organizationId: args.organizationId,
      kind: "workspace_deletion",
      status: "running",
      phase: "organizationActivity",
      confirmationSlug: organization.slug,
      externalDeletion: true,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(organization._id, {
      state: "deleting",
      deletingAt: now,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.organizationJobs.purgeWorkspace, {
      jobId,
    })
    return null
  },
})

export const beginDeletion = mutation({
  args: { organizationId: v.string(), slug: v.string(), confirm: v.boolean() },
  returns: v.id("organizationJobs"),
  handler: async (ctx, args) => {
    const access = await requireOrganizationAdmin(ctx)
    if (
      !args.confirm ||
      args.organizationId !== access.organization.organizationId ||
      args.slug !== access.organization.slug
    ) {
      throw new ConvexError({
        code: "CONFIRMATION_REQUIRED",
        message: "Confirm with the exact workspace ID and slug.",
      })
    }
    const now = Date.now()
    const jobId = await ctx.db.insert("organizationJobs", {
      organizationId: args.organizationId,
      kind: "workspace_deletion",
      status: "running",
      phase: "organizationActivity",
      confirmationSlug: args.slug,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(access.organization._id, {
      state: "deleting",
      deletingAt: now,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.organizationJobs.purgeWorkspace, {
      jobId,
    })
    return jobId
  },
})
