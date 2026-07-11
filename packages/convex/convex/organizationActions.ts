"use node"

import { createClerkClient } from "@clerk/backend"
import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import { action, env, internalAction } from "./_generated/server"
import type { ActionCtx } from "./_generated/server"
import { visitClerkMembershipPages } from "./organizationPagination"

const PROJECTION_BATCH_SIZE = 100

function clerk() {
  if (!env.CLERK_SECRET_KEY) {
    throw new ConvexError({
      code: "CLERK_NOT_CONFIGURED",
      message: "Clerk is not configured.",
    })
  }
  return createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
}

function cleanName(name: string) {
  const value = name.trim()
  if (value.length < 1 || value.length > 80) {
    throw new ConvexError({
      code: "INVALID_NAME",
      message: "Use 1 to 80 characters.",
    })
  }
  return value
}

function cleanSlug(slug?: string) {
  if (slug === undefined) return undefined
  const value = slug.trim().toLowerCase()
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(value)) {
    throw new ConvexError({
      code: "INVALID_SLUG",
      message: "Use a valid workspace slug.",
    })
  }
  return value
}

function membershipView(
  membership: Awaited<
    ReturnType<
      ReturnType<typeof clerk>["organizations"]["getOrganizationMembershipList"]
    >
  >["data"][number]
) {
  const user = membership.publicUserData
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.identifier ||
    "Member"
  return {
    organizationId: membership.organization.id,
    membershipId: membership.id,
    userId: user?.userId ?? "",
    role:
      membership.role === "org:admin"
        ? ("org:admin" as const)
        : ("org:member" as const),
    displayName,
    email: user?.identifier ?? undefined,
    imageUrl: user?.imageUrl ?? undefined,
  }
}

async function syncMemberships(
  ctx: ActionCtx,
  organizationId: string,
  requiredUserId?: string
) {
  let requiredMemberFound = false
  await visitClerkMembershipPages(
    async ({ limit, offset }) =>
      clerk().organizations.getOrganizationMembershipList({
        organizationId,
        limit,
        offset,
        orderBy: "+created_at",
      }),
    async (memberships) => {
      const views = memberships
        .map(membershipView)
        .filter((membership) => membership.userId)
      if (
        requiredUserId &&
        views.some((membership) => membership.userId === requiredUserId)
      ) {
        requiredMemberFound = true
      }
      for (let index = 0; index < views.length; index += PROJECTION_BATCH_SIZE) {
        await ctx.runMutation(internal.organizations.upsertMembers, {
          members: views.slice(index, index + PROJECTION_BATCH_SIZE),
        })
      }
    }
  )
  return requiredUserId === undefined || requiredMemberFound
}

export const syncCurrent = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const token = await ctx.runQuery(
      internal.organizations.activeTokenContext,
      {}
    )
    const organization = await clerk().organizations.getOrganization({
      organizationId: token.organizationId,
    })
    const currentMember = await syncMemberships(
      ctx,
      organization.id,
      token.userId
    )
    if (!currentMember) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You are no longer a member of this workspace.",
      })
    }
    await ctx.runMutation(internal.organizations.upsertOrganization, {
      organizationId: organization.id,
      slug: organization.slug,
      name: organization.name,
    })
    return null
  },
})

export const create = action({
  args: { name: v.string(), slug: v.optional(v.string()) },
  returns: v.object({
    organizationId: v.string(),
    slug: v.string(),
    name: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity)
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Sign in required.",
      })
    const organization = await clerk().organizations.createOrganization({
      name: cleanName(args.name),
      slug: cleanSlug(args.slug),
      createdBy: identity.subject,
    })
    await ctx.runMutation(internal.organizations.upsertOrganization, {
      organizationId: organization.id,
      slug: organization.slug,
      name: organization.name,
    })
    await syncMemberships(ctx, organization.id)
    return {
      organizationId: organization.id,
      slug: organization.slug,
      name: organization.name,
    }
  },
})

export const invite = action({
  args: {
    email: v.string(),
    role: v.union(v.literal("org:admin"), v.literal("org:member")),
  },
  returns: v.object({ invitationId: v.string(), status: v.string() }),
  handler: async (ctx, args) => {
    const admin = await ctx.runQuery(internal.organizations.adminContext, {})
    const email = args.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new ConvexError({
        code: "INVALID_EMAIL",
        message: "Use a valid email address.",
      })
    }
    const invitation = await clerk().organizations.createOrganizationInvitation(
      {
        organizationId: admin.organizationId,
        emailAddress: email,
        role: args.role,
        inviterUserId: admin.userId,
      }
    )
    return {
      invitationId: invitation.id,
      status: invitation.status ?? "pending",
    }
  },
})

export const updateRole = action({
  args: {
    userId: v.string(),
    role: v.union(v.literal("org:admin"), v.literal("org:member")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await ctx.runQuery(internal.organizations.adminContext, {})
    await clerk().organizations.updateOrganizationMembership({
      organizationId: admin.organizationId,
      userId: args.userId,
      role: args.role,
    })
    await syncMemberships(ctx, admin.organizationId)
    return null
  },
})

export const removeMember = action({
  args: {
    organizationId: v.string(),
    organizationSlug: v.string(),
    userId: v.string(),
    confirm: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await ctx.runQuery(internal.organizations.adminContext, {})
    if (
      !args.confirm ||
      args.organizationId !== admin.organizationId ||
      args.organizationSlug !== admin.organizationSlug
    ) {
      throw new ConvexError({
        code: "CONFIRMATION_REQUIRED",
        message: "Confirm with the exact workspace ID and slug.",
      })
    }
    if (args.userId === admin.userId) {
      throw new ConvexError({
        code: "INVALID_MEMBER",
        message: "Transfer admin access before removing yourself.",
      })
    }
    await clerk().organizations.deleteOrganizationMembership({
      organizationId: admin.organizationId,
      userId: args.userId,
    })
    await ctx.runMutation(internal.organizations.removeMemberProjection, {
      organizationId: admin.organizationId,
      userId: args.userId,
    })
    return null
  },
})

export const deleteClerkOrganization = internalAction({
  args: { jobId: v.id("organizationJobs"), organizationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await clerk().organizations.deleteOrganization(args.organizationId)
      await ctx.runMutation(
        internal.organizationJobs.finishWorkspaceDeletion,
        args
      )
    } catch (error) {
      await ctx.runMutation(internal.organizationJobs.failWorkspaceDeletion, {
        jobId: args.jobId,
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Clerk deletion failed",
      })
      throw error
    }
    return null
  },
})
