import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import type { ActionCtx } from "./_generated/server"

type Page<T> = { page: T[]; isDone: boolean; continueCursor: string }

export async function allProjects(ctx: ActionCtx) {
  const rows: Array<Doc<"projects">> = []
  let cursor: string | null = null
  do {
    const page: Page<Doc<"projects">> = await ctx.runQuery(
      internal.tenancyMigrationData.projectPage,
      { paginationOpts: { numItems: 100, cursor } }
    )
    rows.push(...page.page)
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return rows
}

export async function allTasks(ctx: ActionCtx) {
  const rows: Array<Doc<"tasks">> = []
  let cursor: string | null = null
  do {
    const page: Page<Doc<"tasks">> = await ctx.runQuery(
      internal.tenancyMigrationData.taskPage,
      { paginationOpts: { numItems: 100, cursor } }
    )
    rows.push(...page.page)
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return rows
}

export async function allActivity(ctx: ActionCtx) {
  const rows: Array<Doc<"activity">> = []
  let cursor: string | null = null
  do {
    const page: Page<Doc<"activity">> = await ctx.runQuery(
      internal.tenancyMigrationData.activityPage,
      { paginationOpts: { numItems: 100, cursor } }
    )
    rows.push(...page.page)
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return rows
}

export async function allMembers(ctx: ActionCtx) {
  const rows: Array<Doc<"projectMembers">> = []
  let cursor: string | null = null
  do {
    const page: Page<Doc<"projectMembers">> = await ctx.runQuery(
      internal.tenancyMigrationData.memberPage,
      { paginationOpts: { numItems: 100, cursor } }
    )
    rows.push(...page.page)
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return rows
}

export async function countInvites(ctx: ActionCtx) {
  let count = 0
  let cursor: string | null = null
  do {
    const page: Page<Doc<"projectInvites">> = await ctx.runQuery(
      internal.tenancyMigrationData.invitePage,
      { paginationOpts: { numItems: 100, cursor } }
    )
    count += page.page.length
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return count
}

export async function countWorkStates(ctx: ActionCtx) {
  let count = 0
  let cursor: string | null = null
  do {
    const page: Page<Doc<"projectWorkStates">> = await ctx.runQuery(
      internal.tenancyMigrationData.workStatePage,
      { paginationOpts: { numItems: 100, cursor } }
    )
    count += page.page.length
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return count
}

export async function allSubtasks(ctx: ActionCtx) {
  const rows: Array<Doc<"subtasks">> = []
  let cursor: string | null = null
  do {
    const page: Page<Doc<"subtasks">> = await ctx.runQuery(
      internal.tenancyMigrationData.subtaskPage,
      { paginationOpts: { numItems: 100, cursor } }
    )
    rows.push(...page.page)
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return rows
}

export async function allComments(ctx: ActionCtx) {
  const rows: Array<Doc<"taskComments">> = []
  let cursor: string | null = null
  do {
    const page: Page<Doc<"taskComments">> = await ctx.runQuery(
      internal.tenancyMigrationData.commentPage,
      { paginationOpts: { numItems: 100, cursor } }
    )
    rows.push(...page.page)
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return rows
}

export async function allTaskStats(ctx: ActionCtx) {
  const rows: Array<Doc<"taskStats">> = []
  let cursor: string | null = null
  do {
    const page: Page<Doc<"taskStats">> = await ctx.runQuery(
      internal.tenancyMigrationData.taskStatsPage,
      { paginationOpts: { numItems: 100, cursor } }
    )
    rows.push(...page.page)
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return rows
}

export async function allOrganizationActivity(ctx: ActionCtx) {
  const rows: Array<Doc<"organizationActivity">> = []
  let cursor: string | null = null
  do {
    const page: Page<Doc<"organizationActivity">> = await ctx.runQuery(
      internal.tenancyMigrationData.organizationActivityPage,
      { paginationOpts: { numItems: 100, cursor } }
    )
    rows.push(...page.page)
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return rows
}
