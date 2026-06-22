import { ConvexError, v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import { actor, recordActivity, requireProjectOwner } from "./model"

/**
 * Get-or-create the project's reusable invite link, returning its token. Each
 * project has at most one invite row, so opening the Share dialog repeatedly
 * keeps the same link. Owner-only.
 */
export const ensure = mutation({
  args: { projectId: v.id("projects") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { actor: who } = await requireProjectOwner(ctx, args.projectId)
    const existing = await ctx.db
      .query("projectInvites")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique()
    if (existing) return existing.token

    const token = crypto.randomUUID()
    await ctx.db.insert("projectInvites", {
      projectId: args.projectId,
      token,
      createdBy: who.subject,
      createdAt: Date.now(),
    })
    return token
  },
})

/**
 * Rotate the project's invite token. The previous link stops resolving, so this
 * is how an owner invalidates a leaked link while keeping sharing on. Owner-only.
 */
export const regenerate = mutation({
  args: { projectId: v.id("projects") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { actor: who } = await requireProjectOwner(ctx, args.projectId)
    const token = crypto.randomUUID()
    const existing = await ctx.db
      .query("projectInvites")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { token })
    } else {
      await ctx.db.insert("projectInvites", {
        projectId: args.projectId,
        token,
        createdBy: who.subject,
        createdAt: Date.now(),
      })
    }
    return token
  },
})

/** Turn sharing off by deleting the invite row. Owner-only. */
export const revoke = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectOwner(ctx, args.projectId)
    const existing = await ctx.db
      .query("projectInvites")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique()
    if (existing) await ctx.db.delete(existing._id)
    return null
  },
})

/**
 * Resolve an invite token for the join page. Returns the project name + who
 * invited them, plus whether the caller already has access. Returns null when
 * the token is missing or revoked so the page can show an "invalid link" state.
 * Requires auth so we can compute `alreadyMember`.
 */
export const preview = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      projectId: v.id("projects"),
      projectName: v.string(),
      ownerName: v.string(),
      alreadyMember: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const { subject } = await actor(ctx)
    const invite = await ctx.db
      .query("projectInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique()
    if (!invite) return null
    const project = await ctx.db.get(invite.projectId)
    if (!project) return null

    const isOwner = project.ownerSubject === subject
    let alreadyMember = isOwner
    if (!alreadyMember) {
      const membership = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_member", (q) =>
          q.eq("projectId", project._id).eq("subject", subject)
        )
        .unique()
      alreadyMember = membership !== null
    }

    return {
      projectId: project._id,
      projectName: project.name,
      ownerName: project.ownerName ?? "Owner",
      alreadyMember,
    }
  },
})

/**
 * Join a project from an invite link. Idempotent: the owner or an existing
 * member just gets the project id back. A new collaborator is added as an
 * editor and the join is recorded on everyone's activity feed.
 */
export const accept = mutation({
  args: { token: v.string() },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const who = await actor(ctx)
    const invite = await ctx.db
      .query("projectInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique()
    if (!invite) {
      throw new ConvexError({
        code: "INVALID_INVITE",
        message: "This invite link is no longer valid.",
      })
    }
    const project = await ctx.db.get(invite.projectId)
    if (!project) {
      throw new ConvexError({
        code: "INVALID_INVITE",
        message: "This invite link is no longer valid.",
      })
    }

    const projectId: Id<"projects"> = project._id
    if (project.ownerSubject === who.subject) return projectId

    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_member", (q) =>
        q.eq("projectId", projectId).eq("subject", who.subject)
      )
      .unique()
    if (existing) return projectId

    await ctx.db.insert("projectMembers", {
      projectId,
      subject: who.subject,
      role: "editor",
      displayName: who.name,
      createdAt: Date.now(),
    })
    await recordActivity(ctx, {
      project,
      actor: who,
      type: "member.joined",
    })
    return projectId
  },
})
