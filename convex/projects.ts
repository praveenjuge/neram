import { ConvexError, v } from "convex/values"

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"

const counts = {
  todo: 0,
  inProgress: 0,
  done: 0,
}

const projectSummary = v.object({
  _id: v.id("projects"),
  _creationTime: v.number(),
  name: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  taskCount: v.number(),
  todoCount: v.number(),
  inProgressCount: v.number(),
  doneCount: v.number(),
})

async function subject(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in required." })
  return identity.subject
}

function cleanName(name: string) {
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new ConvexError({ code: "INVALID_NAME", message: "Use 1 to 80 characters." })
  }
  return trimmed
}

export const list = query({
  args: {},
  returns: v.array(projectSummary),
  handler: async (ctx) => {
    const ownerSubject = await subject(ctx)
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner_updated", (q) => q.eq("ownerSubject", ownerSubject))
      .order("desc")
      .collect()

    return await Promise.all(
      projects.map(async (project) => {
        const taskCounts = { ...counts }
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_owner_project", (q) => q.eq("ownerSubject", ownerSubject).eq("projectId", project._id))
          .collect()
        for (const task of tasks) taskCounts[task.status] += 1
        return {
          ...project,
          taskCount: tasks.length,
          todoCount: taskCounts.todo,
          inProgressCount: taskCounts.inProgress,
          doneCount: taskCounts.done,
        }
      })
    )
  },
})

export const get = query({
  args: { projectId: v.id("projects") },
  returns: v.union(v.null(), projectSummary),
  handler: async (ctx, args) => {
    const ownerSubject = await subject(ctx)
    const project = await ctx.db.get(args.projectId)
    if (!project || project.ownerSubject !== ownerSubject) return null
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_owner_project", (q) => q.eq("ownerSubject", ownerSubject).eq("projectId", project._id))
      .collect()
    const taskCounts = { ...counts }
    for (const task of tasks) taskCounts[task.status] += 1
    return {
      ...project,
      taskCount: tasks.length,
      todoCount: taskCounts.todo,
      inProgressCount: taskCounts.inProgress,
      doneCount: taskCounts.done,
    }
  },
})

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const ownerSubject = await subject(ctx)
    const now = Date.now()
    return await ctx.db.insert("projects", {
      ownerSubject,
      name: cleanName(args.name),
      createdAt: now,
      updatedAt: now,
    })
  },
})
