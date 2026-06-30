import { ConvexError, v } from "convex/values"

import { mutation, query } from "./_generated/server"
import {
  actor,
  recordActivity,
  requireProjectAccess,
  requireProjectOwner,
} from "./model"

// Membership lists are small; cap the read so it stays bounded regardless.
const MAX_MEMBERS = 200

const memberEntry = v.object({
  subject: v.string(),
  displayName: v.string(),
  role: v.union(v.literal("owner"), v.literal("editor")),
  isYou: v.boolean(),
})

/**
 * The people on a project: the owner first (from the denormalized owner name),
 * then each editor. `isYou` lets the UI label the caller and hide actions that
 * don't apply to them. Readable by any member so the Share dialog can show it.
 */
export const list = query({
  args: { projectId: v.id("projects") },
  returns: v.array(memberEntry),
  handler: async (ctx, args) => {
    const { project, actor: who } = await requireProjectAccess(
      ctx,
      args.projectId
    )
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(MAX_MEMBERS)

    const owner = {
      subject: project.ownerSubject,
      displayName: project.ownerName ?? "Owner",
      role: "owner" as const,
      isYou: project.ownerSubject === who.subject,
    }
    const editors = members.map((member) => ({
      subject: member.subject,
      displayName: member.displayName,
      role: member.role,
      isYou: member.subject === who.subject,
    }))
    return [owner, ...editors]
  },
})

/** Remove a collaborator from the project. Owner-only. */
export const remove = mutation({
  args: { projectId: v.id("projects"), subject: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwner(ctx, args.projectId)
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_member", (q) =>
        q.eq("projectId", args.projectId).eq("subject", args.subject)
      )
      .unique()
    if (!membership) return null

    await ctx.db.delete(membership._id)
    // Drop the removed member's personal recency for this project so it doesn't
    // linger as an orphaned work-state row once they've lost access.
    const workState = await ctx.db
      .query("projectWorkStates")
      .withIndex("by_subject_project", (q) =>
        q.eq("subject", args.subject).eq("projectId", args.projectId)
      )
      .unique()
    if (workState) await ctx.db.delete(workState._id)
    // Attribute the entry to the removed member so the feed reads naturally
    // ("X was removed"). They're already deleted, so they won't receive a row.
    await recordActivity(ctx, {
      project,
      actor: { subject: membership.subject, name: membership.displayName },
      type: "member.removed",
    })
    return null
  },
})

/**
 * Leave a project you've joined. The owner can't leave their own project (they
 * delete it instead); everyone else removes their own membership row.
 */
export const leave = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const who = await actor(ctx)
    const project = await ctx.db.get(args.projectId)
    if (!project) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found.",
      })
    }
    if (project.ownerSubject === who.subject) {
      throw new ConvexError({
        code: "OWNER_CANNOT_LEAVE",
        message: "Delete the project instead.",
      })
    }
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_member", (q) =>
        q.eq("projectId", args.projectId).eq("subject", who.subject)
      )
      .unique()
    if (!membership) return null

    await ctx.db.delete(membership._id)
    // Clear your own personal recency for the project you're leaving so it
    // doesn't linger as an orphaned work-state row after you lose access.
    const workState = await ctx.db
      .query("projectWorkStates")
      .withIndex("by_subject_project", (q) =>
        q.eq("subject", who.subject).eq("projectId", args.projectId)
      )
      .unique()
    if (workState) await ctx.db.delete(workState._id)
    await recordActivity(ctx, {
      project,
      actor: who,
      type: "member.left",
    })
    return null
  },
})
