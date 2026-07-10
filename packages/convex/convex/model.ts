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

export type Actor = {
  subject: string
  userId: string
  name: string
  organizationId?: string
  organizationSlug?: string
  organizationRole?: "org:admin" | "org:member"
}

function stringClaim(identity: object, key: string) {
  const value = (identity as Record<string, unknown>)[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

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
    userId: identity.subject,
    name: identity.name ?? identity.email ?? "Someone",
    organizationId: stringClaim(identity, "org_id"),
    organizationSlug: stringClaim(identity, "org_slug"),
    organizationRole: stringClaim(identity, "org_role") as
      "org:admin" | "org:member" | undefined,
  }
}

export type OrganizationAccess = {
  actor: Actor & { organizationId: string }
  organization: Doc<"organizations">
  membership: Doc<"organizationMembers">
}

/**
 * Resolve the active Clerk Organization and its webhook-synchronized member.
 * The projection is intentionally required even when a signed token still has
 * an Organization claim, so a removed member loses access immediately.
 */
export async function requireOrganization(
  ctx: QueryCtx | MutationCtx
): Promise<OrganizationAccess> {
  const a = await actor(ctx)
  if (!a.organizationId) {
    throw new ConvexError({
      code: "ORGANIZATION_REQUIRED",
      message: "Choose a workspace and sign in again.",
    })
  }
  const organization = await ctx.db
    .query("organizations")
    .withIndex("by_organization_id", (q) =>
      q.eq("organizationId", a.organizationId as string)
    )
    .unique()
  if (!organization || organization.state !== "active") {
    throw new ConvexError({
      code:
        organization?.state === "deleting" ? "WORKSPACE_DELETING" : "NOT_FOUND",
      message:
        organization?.state === "deleting"
          ? "This workspace is being deleted."
          : "Workspace not found.",
    })
  }
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_organization_and_user", (q) =>
      q.eq("organizationId", a.organizationId as string).eq("userId", a.userId)
    )
    .unique()
  if (!membership) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You are no longer a member of this workspace.",
    })
  }
  return {
    actor: { ...a, organizationId: a.organizationId },
    organization,
    membership,
  }
}

export async function requireOrganizationAdmin(ctx: QueryCtx | MutationCtx) {
  const access = await requireOrganization(ctx)
  if (access.membership.role !== "org:admin") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Workspace admin access required.",
    })
  }
  return access
}

/**
 * Resolve a task assignee from a subject, validating they're actually on the
 * project (the owner or a member). Returns the canonical subject plus the
 * authoritative display name to denormalize onto the task. Throws if the
 * subject isn't part of the project so a task can't be assigned to a stranger.
 */
export async function resolveAssignee(
  ctx: QueryCtx | MutationCtx,
  project: Doc<"projects">,
  assigneeSubject: string
): Promise<Actor> {
  if (project.organizationId) {
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_and_user", (q) =>
        q
          .eq("organizationId", project.organizationId as string)
          .eq("userId", assigneeSubject)
      )
      .unique()
    if (!membership) {
      throw new ConvexError({
        code: "INVALID_ASSIGNEE",
        message: "Choose someone in this workspace.",
      })
    }
    return {
      subject: membership.userId,
      userId: membership.userId,
      name: membership.displayName,
      organizationId: membership.organizationId,
      organizationRole: membership.role,
    }
  }
  if (assigneeSubject === project.ownerSubject) {
    return {
      subject: assigneeSubject,
      userId: assigneeSubject,
      name: project.ownerName ?? "Owner",
    }
  }
  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_member", (q) =>
      q.eq("projectId", project._id).eq("subject", assigneeSubject)
    )
    .unique()
  if (!membership) {
    throw new ConvexError({
      code: "INVALID_ASSIGNEE",
      message: "Choose someone on this project.",
    })
  }
  return {
    subject: membership.subject,
    userId: membership.subject,
    name: membership.displayName,
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
  if (project.organizationId) {
    const access = await requireOrganization(ctx)
    if (access.organization.organizationId !== project.organizationId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found.",
      })
    }
    return {
      project,
      actor: access.actor,
      role: access.membership.role === "org:admin" ? "owner" : "editor",
      isOwner: access.membership.role === "org:admin",
    }
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
  if (project.organizationId) {
    const access = await requireOrganizationAdmin(ctx)
    if (access.organization.organizationId !== project.organizationId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found.",
      })
    }
    return { project, actor: access.actor }
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
    taskId?: Id<"tasks">
    commentId?: Id<"taskComments">
    commentExcerpt?: string
    toStatus?: Doc<"tasks">["status"]
    assigneeSubject?: string
    assigneeName?: string
  }
) {
  if (args.project.organizationId) {
    await ctx.db.insert("organizationActivity", {
      organizationId: args.project.organizationId,
      actorUserId: args.actor.userId,
      actorName: args.actor.name,
      projectId: args.project._id,
      projectName: args.project.name,
      type: args.type,
      taskTitle: args.taskTitle,
      taskId: args.taskId,
      commentId: args.commentId,
      commentExcerpt: args.commentExcerpt,
      toStatus: args.toStatus,
      assigneeUserId: args.assigneeSubject,
      assigneeName: args.assigneeName,
      createdAt: Date.now(),
    })
    return
  }
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
      taskId: args.taskId,
      commentId: args.commentId,
      commentExcerpt: args.commentExcerpt,
      toStatus: args.toStatus,
      assigneeSubject: args.assigneeSubject,
      assigneeName: args.assigneeName,
      createdAt: now,
    })
  }
}

/** Write one targeted activity row without broadcasting ordinary comment work. */
export async function recordTargetedActivity(
  ctx: MutationCtx,
  args: {
    subject: string
    project: Doc<"projects">
    actor: Actor
    type: "comment.mentioned" | "comment.replied"
    taskId: Id<"tasks">
    taskTitle: string
    commentId: Id<"taskComments">
    commentExcerpt: string
  }
) {
  if (args.project.organizationId) {
    await ctx.db.insert("organizationActivity", {
      organizationId: args.project.organizationId,
      actorUserId: args.actor.userId,
      actorName: args.actor.name,
      projectId: args.project._id,
      projectName: args.project.name,
      type: args.type,
      taskTitle: args.taskTitle,
      taskId: args.taskId,
      commentId: args.commentId,
      commentExcerpt: args.commentExcerpt,
      recipientUserId: args.subject.split("|").at(-1) ?? args.subject,
      createdAt: Date.now(),
    })
    return
  }
  await ctx.db.insert("activity", {
    subject: args.subject,
    actorSubject: args.actor.subject,
    actorName: args.actor.name,
    projectId: args.project._id,
    projectName: args.project.name,
    type: args.type,
    taskTitle: args.taskTitle,
    taskId: args.taskId,
    commentId: args.commentId,
    commentExcerpt: args.commentExcerpt,
    createdAt: Date.now(),
  })
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
