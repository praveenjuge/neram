import { ConvexError, v } from "convex/values"

import { query } from "./_generated/server"
import { projectCounts } from "./model"
import { accessibleProjects } from "./projects"

/**
 * Canonical, server-authoritative workspace status for the CLI and MCP. Returns
 * the caller's identity (name/email straight from the verified auth token) plus
 * workspace totals derived from the projects they can see. Totals reuse the
 * denormalized per-project counters, so this stays a bounded read with no extra
 * per-task scans. Assigned-open counts are intentionally omitted for now.
 */
export const status = query({
  args: {},
  returns: v.object({
    identity: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
    workspace: v.object({
      projects: v.number(),
      ownedProjects: v.number(),
      sharedProjects: v.number(),
      openTasks: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Sign in required.",
      })
    }
    // tokenIdentifier is the canonical stable identity key used everywhere else.
    const organizationId = (identity as Record<string, unknown>).org_id
    const projects = await accessibleProjects(
      ctx,
      identity.tokenIdentifier,
      typeof organizationId === "string" ? organizationId : undefined
    )
    let ownedProjects = 0
    let sharedProjects = 0
    let openTasks = 0
    for (const { project, role } of projects) {
      if (role === "owner") ownedProjects += 1
      else sharedProjects += 1
      const counts = projectCounts(project)
      openTasks += counts.todoCount + counts.inProgressCount
    }
    return {
      identity: {
        name: identity.name,
        email: identity.email,
      },
      workspace: {
        projects: projects.length,
        ownedProjects,
        sharedProjects,
        openTasks,
      },
    }
  },
})
