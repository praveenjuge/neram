import { paginationOptsValidator } from "convex/server"

import { query } from "./_generated/server"
import { actor } from "./model"

/**
 * The caller's personal activity feed: their own and collaborators' actions
 * across every project they own or have joined, newest first. Backed by the
 * per-recipient fan-out, so this is a single indexed read of the caller's rows.
 */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { subject, organizationId } = await actor(ctx)
    if (organizationId) {
      return await ctx.db
        .query("organizationActivity")
        .withIndex("by_organization_and_created_at", (q) =>
          q.eq("organizationId", organizationId)
        )
        .order("desc")
        .paginate(args.paginationOpts)
    }
    return await ctx.db
      .query("activity")
      .withIndex("by_subject_created", (q) => q.eq("subject", subject))
      .order("desc")
      .paginate(args.paginationOpts)
  },
})
