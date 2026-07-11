import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server"
import { ConvexError, v } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import { mutation, query, type MutationCtx } from "./_generated/server"
import { recordTargetedActivity } from "./model"
import { mention } from "./schema"
import {
  patchTaskStats,
  requireTaskAccess,
  taskCounts,
  taskStats,
} from "./taskModel"

const ROOT_PAGE_SIZE = 20
const REPLY_PAGE_SIZE = 10
const MAX_MEMBERS = 500
const MAX_ANCESTRY_PAGE = 100

const comment = v.object({
  _id: v.id("taskComments"),
  _creationTime: v.number(),
  taskId: v.id("tasks"),
  parentCommentId: v.optional(v.id("taskComments")),
  rootCommentId: v.optional(v.id("taskComments")),
  authorSubject: v.string(),
  authorName: v.string(),
  body: v.string(),
  mentions: v.array(mention),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
})

type Mention = Doc<"taskComments">["mentions"][number]

function cleanBody(value: string) {
  const body = value.replace(/\r\n?/g, "\n")
  if (body.trim().length < 1 || body.length > 5000) {
    throw new ConvexError({
      code: "INVALID_COMMENT",
      message: "Use 1 to 5,000 characters.",
    })
  }
  return body
}

function excerpt(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 160)
}

async function validateMentions(
  ctx: MutationCtx,
  args: {
    project: Doc<"projects">
    body: string
    mentions: Mention[]
  }
) {
  const members = await ctx.db
    .query("organizationMembers")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", args.project.organizationId)
    )
    .take(MAX_MEMBERS + 1)
  if (members.length > MAX_MEMBERS) {
    throw new ConvexError({
      code: "MEMBER_LIMIT",
      message: "This workspace exceeds the supported member limit.",
    })
  }
  const subjects = new Set(members.map((member) => member.userId))
  const ordered = [...args.mentions].sort((a, b) => a.start - b.start)
  let previousEnd = 0
  for (const item of ordered) {
    const expected = `@${item.label}`
    const end = item.start + item.length
    if (
      !Number.isInteger(item.start) ||
      !Number.isInteger(item.length) ||
      item.start < previousEnd ||
      item.length < 2 ||
      end > args.body.length ||
      args.body.slice(item.start, end) !== expected
    ) {
      throw new ConvexError({
        code: "INVALID_MENTION",
        message: "Mention spans must match the comment text.",
      })
    }
    if (!subjects.has(item.subject)) {
      throw new ConvexError({
        code: "INVALID_MENTION_SUBJECT",
        message: `${item.label} is not a member of this workspace.`,
        subject: item.subject,
      })
    }
    previousEnd = end
  }
  return ordered
}

async function touchTask(ctx: MutationCtx, task: Doc<"tasks">) {
  const now = Date.now()
  await ctx.db.patch(task._id, { updatedAt: now })
  await ctx.db.patch(task.projectId, { updatedAt: now })
  return now
}

export const list = query({
  args: {
    taskId: v.id("tasks"),
    parentCommentId: v.optional(v.id("taskComments")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(comment),
  handler: async (ctx, args) => {
    await requireTaskAccess(ctx, args.taskId)
    if (args.parentCommentId) {
      const parent = await ctx.db.get(args.parentCommentId)
      if (!parent || parent.taskId !== args.taskId) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Comment not found.",
        })
      }
    }
    return await ctx.db
      .query("taskComments")
      .withIndex("by_task_and_parent_and_created", (q) =>
        q.eq("taskId", args.taskId).eq("parentCommentId", args.parentCommentId)
      )
      .order("asc")
      .paginate({
        cursor: args.paginationOpts.cursor,
        numItems: Math.min(
          args.paginationOpts.numItems,
          args.parentCommentId ? REPLY_PAGE_SIZE : ROOT_PAGE_SIZE
        ),
      })
  },
})

export const getAncestry = query({
  args: {
    commentId: v.id("taskComments"),
    startCommentId: v.optional(v.id("taskComments")),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    taskId: v.id("tasks"),
    comments: v.array(comment),
    nextCommentId: v.optional(v.id("taskComments")),
  }),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.commentId)
    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Comment not found.",
      })
    }
    await requireTaskAccess(ctx, target.taskId)
    let current = args.startCommentId
      ? await ctx.db.get(args.startCommentId)
      : target
    if (!current || current.taskId !== target.taskId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Comment not found.",
      })
    }
    const page: Doc<"taskComments">[] = []
    const limit = Math.max(
      1,
      Math.min(Math.floor(args.limit ?? 50), MAX_ANCESTRY_PAGE)
    )
    while (current && page.length < limit) {
      page.push(current)
      current = current.parentCommentId
        ? await ctx.db.get(current.parentCommentId)
        : null
    }
    return {
      taskId: target.taskId,
      comments: page.reverse(),
      nextCommentId: current?._id,
    }
  },
})

async function createComment(
  ctx: MutationCtx,
  args: {
    taskId: Doc<"tasks">["_id"]
    parentCommentId?: Doc<"taskComments">["_id"]
    body: string
    mentions: Mention[]
  }
) {
  const { task, project, actor } = await requireTaskAccess(ctx, args.taskId)
  const body = cleanBody(args.body)
  const mentions = await validateMentions(ctx, {
    project,
    body,
    mentions: args.mentions,
  })
  const parent = args.parentCommentId
    ? await ctx.db.get(args.parentCommentId)
    : null
  if (args.parentCommentId && (!parent || parent.taskId !== task._id)) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Comment not found." })
  }
  const now = await touchTask(ctx, task)
  const commentId = await ctx.db.insert("taskComments", {
    taskId: task._id,
    parentCommentId: parent?._id,
    rootCommentId: parent ? (parent.rootCommentId ?? parent._id) : undefined,
    authorSubject: actor.subject,
    authorName: actor.name,
    body,
    mentions,
    createdAt: now,
    updatedAt: now,
  })
  const stats = await taskStats(ctx, task._id)
  const counts = taskCounts(stats)
  await patchTaskStats(ctx, {
    taskId: task._id,
    projectId: task.projectId,
    activeCommentCount: counts.activeCommentCount + 1,
  })

  const notified = new Set<string>()
  for (const item of mentions) {
    if (item.subject === actor.subject || notified.has(item.subject)) continue
    notified.add(item.subject)
    await recordTargetedActivity(ctx, {
      subject: item.subject,
      project,
      actor,
      type: "comment.mentioned",
      taskId: task._id,
      taskTitle: task.title,
      commentId,
      commentExcerpt: excerpt(body),
    })
  }
  if (
    parent &&
    !parent.deletedAt &&
    parent.authorSubject !== actor.subject &&
    !notified.has(parent.authorSubject)
  ) {
    await recordTargetedActivity(ctx, {
      subject: parent.authorSubject,
      project,
      actor,
      type: "comment.replied",
      taskId: task._id,
      taskTitle: task.title,
      commentId,
      commentExcerpt: excerpt(body),
    })
  }
  return commentId
}

export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    body: v.string(),
    mentions: v.array(mention),
  },
  returns: v.id("taskComments"),
  handler: async (ctx, args) => await createComment(ctx, args),
})

export const reply = mutation({
  args: {
    commentId: v.id("taskComments"),
    body: v.string(),
    mentions: v.array(mention),
  },
  returns: v.id("taskComments"),
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.commentId)
    if (!parent) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Comment not found.",
      })
    }
    return await createComment(ctx, {
      taskId: parent.taskId,
      parentCommentId: parent._id,
      body: args.body,
      mentions: args.mentions,
    })
  },
})

export const edit = mutation({
  args: {
    commentId: v.id("taskComments"),
    body: v.string(),
    mentions: v.array(mention),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.commentId)
    if (!current) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Comment not found.",
      })
    }
    const { task, project, actor } = await requireTaskAccess(
      ctx,
      current.taskId
    )
    if (current.deletedAt) {
      throw new ConvexError({
        code: "COMMENT_DELETED",
        message: "A deleted comment cannot be edited.",
      })
    }
    if (current.authorSubject !== actor.subject) {
      throw new ConvexError({
        code: "FORBIDDEN_MODERATION",
        message: "Only the comment author can edit it.",
      })
    }
    const body = cleanBody(args.body)
    const mentions = await validateMentions(ctx, {
      project,
      body,
      mentions: args.mentions,
    })
    const now = await touchTask(ctx, task)
    await ctx.db.patch(current._id, { body, mentions, updatedAt: now })
    const previouslyMentioned = new Set(
      current.mentions.map((item) => item.subject)
    )
    const notified = new Set<string>()
    for (const item of mentions) {
      if (
        item.subject === actor.subject ||
        previouslyMentioned.has(item.subject) ||
        notified.has(item.subject)
      ) {
        continue
      }
      notified.add(item.subject)
      await recordTargetedActivity(ctx, {
        subject: item.subject,
        project,
        actor,
        type: "comment.mentioned",
        taskId: task._id,
        taskTitle: task.title,
        commentId: current._id,
        commentExcerpt: excerpt(body),
      })
    }
    return null
  },
})

export const remove = mutation({
  args: { commentId: v.id("taskComments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.commentId)
    if (!current) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Comment not found.",
      })
    }
    const { task, actor, isAdmin } = await requireTaskAccess(
      ctx,
      current.taskId
    )
    if (current.authorSubject !== actor.subject && !isAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN_MODERATION",
        message:
          "Only the author or a workspace admin can delete this comment.",
      })
    }
    if (current.deletedAt) return null
    const now = await touchTask(ctx, task)
    await ctx.db.patch(current._id, {
      body: "",
      mentions: [],
      deletedAt: now,
      updatedAt: now,
    })
    const stats = await taskStats(ctx, task._id)
    const counts = taskCounts(stats)
    await patchTaskStats(ctx, {
      taskId: task._id,
      projectId: task.projectId,
      activeCommentCount: counts.activeCommentCount - 1,
    })
    return null
  },
})
