import { ConvexError } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

/**
 * The canonical owner key for the authenticated caller.
 *
 * Per Convex guidance we key ownership off `identity.tokenIdentifier` (a stable,
 * issuer-scoped identifier) rather than `identity.subject` alone. Existing rows
 * created before this change are re-keyed by `migrateOwnership` in projects.ts.
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

/**
 * Returns the project's task counts. Uses the denormalized counters when they
 * are present; otherwise computes them from the tasks table (the slow path for
 * legacy documents created before counters existed). Mutations persist the
 * resolved counts so the slow path runs at most once per project.
 */
export async function resolveCounts(
  ctx: QueryCtx | MutationCtx,
  project: Doc<"projects">
): Promise<ProjectCounts> {
  if (
    project.taskCount !== undefined &&
    project.todoCount !== undefined &&
    project.inProgressCount !== undefined &&
    project.doneCount !== undefined
  ) {
    return {
      taskCount: project.taskCount,
      todoCount: project.todoCount,
      inProgressCount: project.inProgressCount,
      doneCount: project.doneCount,
    }
  }

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_owner_project", (q) =>
      q.eq("ownerSubject", project.ownerSubject).eq("projectId", project._id)
    )
    .collect()

  const counts: ProjectCounts = {
    taskCount: tasks.length,
    todoCount: 0,
    inProgressCount: 0,
    doneCount: 0,
  }
  for (const task of tasks) counts[statusCountField[task.status]] += 1
  return counts
}
