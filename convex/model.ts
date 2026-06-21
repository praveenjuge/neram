import { ConvexError } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

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
