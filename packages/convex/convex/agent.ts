import { ConvexError, v } from "convex/values"

import { query } from "./_generated/server"
import { projectCounts, requireOrganization } from "./model"
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
    organization: v.object({
      organizationId: v.string(),
      slug: v.string(),
      name: v.string(),
      role: v.union(v.literal("org:admin"), v.literal("org:member")),
    }),
    workspace: v.object({
      projects: v.number(),
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
    const access = await requireOrganization(ctx)
    const projects = await accessibleProjects(ctx)
    let openTasks = 0
    for (const { project } of projects) {
      const counts = projectCounts(project)
      openTasks += counts.todoCount + counts.inProgressCount
    }
    return {
      identity: {
        name: identity.name,
        email: identity.email,
      },
      organization: {
        organizationId: access.organization.organizationId,
        slug: access.organization.slug,
        name: access.organization.name,
        role: access.membership.role,
      },
      workspace: {
        projects: projects.length,
        openTasks,
      },
    }
  },
})
