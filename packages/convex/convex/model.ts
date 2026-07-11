import { ConvexError } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

export type Actor = {
  subject: string
  userId: string
  name: string
  organizationId: string
}

function stringClaim(identity: object, key: string) {
  const value = (identity as Record<string, unknown>)[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

/**
 * The authenticated caller and their required active Clerk Organization.
 */
export async function actor(ctx: QueryCtx | MutationCtx): Promise<Actor> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in required.",
    })
  }
  const organizationId = stringClaim(identity, "org_id")
  if (!organizationId) {
    throw new ConvexError({
      code: "ORGANIZATION_REQUIRED",
      message: "Choose a workspace and sign in again.",
    })
  }
  return {
    subject: identity.subject,
    userId: identity.subject,
    name: identity.name ?? identity.email ?? "Someone",
    organizationId,
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
  const organization = await ctx.db
    .query("organizations")
    .withIndex("by_organization_id", (q) =>
      q.eq("organizationId", a.organizationId)
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
      q.eq("organizationId", a.organizationId).eq("userId", a.userId)
    )
    .unique()
  if (!membership) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You are no longer a member of this workspace.",
    })
  }
  return {
    actor: a,
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
 * Resolve a task assignee from a Clerk user id, validating they're in the
 * Organization. Returns the canonical id plus the
 * authoritative display name to denormalize onto the task. Throws if the
 * user isn't part of the Organization so a task can't be assigned to a stranger.
 */
export async function resolveAssignee(
  ctx: QueryCtx | MutationCtx,
  project: Doc<"projects">,
  assigneeSubject: string
): Promise<{
  subject: string
  userId: string
  name: string
  organizationId: string
  organizationRole: "org:admin" | "org:member"
}> {
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_organization_and_user", (q) =>
      q
        .eq("organizationId", project.organizationId)
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

export type ProjectRole = "org:admin" | "org:member"

export type ProjectAccess = {
  project: Doc<"projects">
  actor: Actor
  role: ProjectRole
  isAdmin: boolean
}

/**
 * Resolve project access exclusively through the active Organization.
 */
export async function requireProjectAccess(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">
): Promise<ProjectAccess> {
  const access = await requireOrganization(ctx)
  const project = await ctx.db.get(projectId)
  if (
    !project ||
    project.organizationId !== access.organization.organizationId
  ) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Project not found." })
  }
  return {
    project,
    actor: access.actor,
    role: access.membership.role,
    isAdmin: access.membership.role === "org:admin",
  }
}

/** Resolve a project and require Organization admin governance. */
export async function requireProjectAdmin(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">
): Promise<{ project: Doc<"projects">; actor: Actor }> {
  const access = await requireOrganizationAdmin(ctx)
  const project = await ctx.db.get(projectId)
  if (
    !project ||
    project.organizationId !== access.organization.organizationId
  ) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Project not found." })
  }
  return { project, actor: access.actor }
}

export type ActivityType = Doc<"organizationActivity">["type"]

/**
 * Append one Organization activity row. All current and future members can
 * read the complete workspace history.
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
    recipientUserId: args.subject,
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
