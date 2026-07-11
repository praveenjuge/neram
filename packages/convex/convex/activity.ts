import { paginationOptsValidator } from "convex/server"

import { query } from "./_generated/server"
import { requireOrganization } from "./model"

/**
 * Organization history, newest first. Targeted comment notifications are
 * visible only to their recipient; general history is visible to all members.
 */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireOrganization(ctx)
    const result = await ctx.db
      .query("organizationActivity")
      .withIndex("by_organization_and_created_at", (q) =>
        q.eq("organizationId", access.organization.organizationId)
      )
      .order("desc")
      .paginate(args.paginationOpts)
    return {
      ...result,
      page: result.page.filter(
        (row) =>
          !row.recipientUserId || row.recipientUserId === access.actor.userId
      ),
    }
  },
})
