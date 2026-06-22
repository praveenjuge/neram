import { ConvexError } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

// Upper bound on how many member rows a single action fans out to / reads.
// Membership lists are small in practice; this keeps the read/write bounded.
const MAX_MEMBERS = 200

/**
 * The canonical owner key for the authenticated caller.
 *
 * Per Convex guidance we key ownership off `identity.tokenIdentifier` (a stable,
 * issuer-scoped identifier) rather than `identity.subject` alone.
 */
export async function owner(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in required.",
    })
  }
  return identity.tokenIdentifier
}

export type Actor = { subject: string; name: string }

/**
 * The authenticated caller as an actor: their canonical subject plus a
 * best-effort display name used to denormalize activity rows and member names.
 */
export async function actor(ctx: QueryCtx | MutationCtx): Promise<Actor> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in required.",
    })
  }
  return {
    subject: identity.tokenIdentifier,
    name: identity.name ?? identity.email ?? "Someone",
  }
}

export type ProjectRole = "owner" | "editor"

export type ProjectAccess = {
  project: Doc<"projects">
  actor: Actor
  role: ProjectRole
  isOwner: boolean
}

/**
 * Resolve the caller's access to a project. The owner always has access; anyone
 * else must have a `projectMembers` row. Throws NOT_FOUND otherwise, so callers
 * can't tell apart "missing" from "no access". Used by every read/edit path.
 */
export async function requireProjectAccess(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">
): Promise<ProjectAccess> {
  const a = await actor(ctx)
  const project = await ctx.db.get(projectId)
  if (!project) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Project not found." })
  }
  if (project.ownerSubject === a.subject) {
    return { project, actor: a, role: "owner", isOwner: true }
  }
  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_member", (q) =>
      q.eq("projectId", projectId).eq("subject", a.subject)
    )
    .unique()
  if (!membership) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Project not found." })
  }
  return { project, actor: a, role: "editor", isOwner: false }
}

/**
 * Resolve the caller as the project owner, throwing otherwise. Used by the
 * owner-only paths: sharing, member removal, and project deletion.
 */
export async function requireProjectOwner(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">
): Promise<{ project: Doc<"projects">; actor: Actor }> {
  const a = await actor(ctx)
  const project = await ctx.db.get(projectId)
  if (!project) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Project not found." })
  }
  if (project.ownerSubject !== a.subject) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Only the project owner can do this.",
    })
  }
  return { project, actor: a }
}

export type ActivityType = Doc<"activity">["type"]

/**
 * Fan an activity entry out to everyone who can see the project: the owner plus
 * every member. One row per recipient keeps each user's feed a single indexed
 * read. Members only receive rows created after they joined, since their rows
 * only start being written once they appear in `projectMembers`.
 */
export async function recordActivity(
  ctx: MutationCtx,
  args: {
    project: Doc<"projects">
    actor: Actor
    type: ActivityType
    taskTitle?: string
    toStatus?: Doc<"tasks">["status"]
  }
) {
  const members = await ctx.db
    .query("projectMembers")
    .withIndex("by_project", (q) => q.eq("projectId", args.project._id))
    .take(MAX_MEMBERS)

  // Dedupe defensively; the owner is never stored as a member, but this keeps
  // the fan-out correct even if that invariant ever changes.
  const recipients = new Set<string>([args.project.ownerSubject])
  for (const member of members) recipients.add(member.subject)

  const now = Date.now()
  for (const subject of recipients) {
    await ctx.db.insert("activity", {
      subject,
      actorSubject: args.actor.subject,
      actorName: args.actor.name,
      projectId: args.project._id,
      projectName: args.project.name,
      type: args.type,
      taskTitle: args.taskTitle,
      toStatus: args.toStatus,
      createdAt: now,
    })
  }
}

export type TaskStatus = Doc<"tasks">["status"]

export type ProjectCounts = {
  taskCount: number
  todoCount: number
  inProgressCount: number
  doneCount: number
}

/** Maps a task status to its denormalized counter field on the project doc. */
export const statusCountField: Record<TaskStatus, keyof ProjectCounts> = {
  todo: "todoCount",
  inProgress: "inProgressCount",
  done: "doneCount",
}

/** Reads the denormalized task counts off a project document. */
export function projectCounts(project: Doc<"projects">): ProjectCounts {
  return {
    taskCount: project.taskCount,
    todoCount: project.todoCount,
    inProgressCount: project.inProgressCount,
    doneCount: project.doneCount,
  }
}
