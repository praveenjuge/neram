/// <reference types="vite/client" />
import { expect, test } from "vitest"

import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { organizationFixture } from "../test-utils/organization"

const modules = import.meta.glob("./**/*.ts")

const firstPage = { paginationOpts: { numItems: 20, cursor: null } }

async function organizationProject() {
  const { t, alice, bob } = await organizationFixture(modules)
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  return { t, alice, bob, projectId }
}

test("missing taskStats is canonically zero", async () => {
  const { alice } = await organizationFixture(modules)
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Ship",
  })

  await expect(alice.query(api.tasks.get, { taskId })).resolves.toMatchObject({
    totalSubtasks: 0,
    completedSubtasks: 0,
    activeCommentCount: 0,
  })
})

test("editors manage ordered subtasks and counters stay correct", async () => {
  const { alice, bob, projectId } = await organizationProject()
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Ship",
  })
  const first = await bob.mutation(api.subtasks.create, {
    taskId,
    title: "First",
  })
  const second = await bob.mutation(api.subtasks.create, {
    taskId,
    title: "Second",
  })
  const third = await bob.mutation(api.subtasks.create, {
    taskId,
    title: "Third",
  })

  await bob.mutation(api.subtasks.reorder, {
    subtaskId: third,
    beforeSubtaskId: first,
  })
  expect(
    (await alice.query(api.subtasks.list, { taskId })).map((row) => row.title)
  ).toEqual(["Third", "First", "Second"])

  await bob.mutation(api.subtasks.rename, {
    subtaskId: first,
    title: "Renamed",
  })
  await bob.mutation(api.subtasks.setCompleted, {
    subtaskId: second,
    completed: true,
  })
  await bob.mutation(api.subtasks.remove, { subtaskId: first })
  await expect(alice.query(api.tasks.get, { taskId })).resolves.toMatchObject({
    totalSubtasks: 2,
    completedSubtasks: 1,
  })
})

test("completion requires explicit acknowledgement when subtasks remain", async () => {
  const { alice } = await organizationFixture(modules)
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Ship",
  })
  await alice.mutation(api.subtasks.create, { taskId, title: "Verify" })

  await expect(
    alice.mutation(api.tasks.move, { taskId, status: "done" })
  ).rejects.toThrow()
  await alice.mutation(api.tasks.move, {
    taskId,
    status: "done",
    confirmIncompleteSubtasks: true,
  })
  expect((await alice.query(api.tasks.get, { taskId }))?.status).toBe("done")
})

test("threaded comments paginate by level and target mention/reply activity", async () => {
  const { alice, bob, projectId } = await organizationProject()
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Ship",
  })
  const root = await alice.mutation(api.taskComments.create, {
    taskId,
    body: "Hi @Bob",
    mentions: [{ start: 3, length: 4, subject: "user_bob", label: "Bob" }],
  })
  const reply = await bob.mutation(api.taskComments.reply, {
    commentId: root,
    body: "On it",
    mentions: [],
  })
  const nested = await alice.mutation(api.taskComments.reply, {
    commentId: reply,
    body: "Thanks",
    mentions: [],
  })

  const roots = await alice.query(api.taskComments.list, {
    taskId,
    ...firstPage,
  })
  expect(roots.page.map((row) => row._id)).toEqual([root])
  const replies = await alice.query(api.taskComments.list, {
    taskId,
    parentCommentId: root,
    paginationOpts: { numItems: 20, cursor: null },
  })
  expect(replies.page.map((row) => row._id)).toEqual([reply])
  expect(
    (
      await alice.query(api.taskComments.getAncestry, { commentId: nested })
    ).comments.map((row) => row._id)
  ).toEqual([root, reply, nested])

  const bobActivity = await bob.query(api.activity.list, firstPage)
  expect(bobActivity.page).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "comment.mentioned",
        taskId,
        commentId: root,
      }),
    ])
  )
  const aliceActivity = await alice.query(api.activity.list, firstPage)
  expect(aliceActivity.page).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "comment.replied",
        taskId,
        commentId: reply,
      }),
    ])
  )
})

test("comment edit permissions and admin tombstones preserve descendants", async () => {
  const { alice, bob, projectId } = await organizationProject()
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Ship",
  })
  const root = await bob.mutation(api.taskComments.create, {
    taskId,
    body: "Original",
    mentions: [],
  })
  await alice.mutation(api.taskComments.reply, {
    commentId: root,
    body: "Child",
    mentions: [],
  })
  await expect(
    alice.mutation(api.taskComments.edit, {
      commentId: root,
      body: "Nope",
      mentions: [],
    })
  ).rejects.toThrow()
  await bob.mutation(api.taskComments.edit, {
    commentId: root,
    body: "Edited",
    mentions: [],
  })
  await alice.mutation(api.taskComments.remove, { commentId: root })

  const roots = await alice.query(api.taskComments.list, {
    taskId,
    ...firstPage,
  })
  expect(roots.page[0]).toMatchObject({
    body: "",
    deletedAt: expect.any(Number),
  })
  const detail = await alice.query(api.tasks.get, { taskId })
  expect(detail?.activeCommentCount).toBe(1)
})

test("moving tasks carries children and cascade deletion requires acknowledgement", async () => {
  const { alice } = await organizationFixture(modules)
  const from = await alice.mutation(api.projects.create, { name: "From" })
  const to = await alice.mutation(api.projects.create, { name: "To" })
  const taskId = await alice.mutation(api.tasks.create, {
    projectId: from,
    title: "Ship",
  })
  await alice.mutation(api.subtasks.create, { taskId, title: "Verify" })
  await alice.mutation(api.taskComments.create, {
    taskId,
    body: "Ready",
    mentions: [],
  })

  await alice.mutation(api.tasks.changeProject, { taskId, projectId: to })
  await expect(alice.query(api.tasks.get, { taskId })).resolves.toMatchObject({
    projectId: to,
    totalSubtasks: 1,
    activeCommentCount: 1,
  })
  await expect(alice.mutation(api.tasks.remove, { taskId })).rejects.toThrow()
  await expect(
    alice.mutation(api.tasks.remove, { taskId, confirmCascade: true })
  ).resolves.toEqual({ subtaskCount: 1, commentCount: 1 })
})

test("task inline edits return conflicts instead of overwriting newer values", async () => {
  const { alice } = await organizationFixture(modules)
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Original",
  })
  await alice.mutation(api.tasks.update, { taskId, title: "Newest" })
  await expect(
    alice.mutation(api.tasks.update, {
      taskId,
      title: "Stale edit",
      expectedTitle: "Original",
    })
  ).rejects.toThrow()
  expect((await alice.query(api.tasks.get, { taskId }))?.title).toBe("Newest")
})

test("comment pagination is capped per level and invalid mentions fail", async () => {
  const { alice } = await organizationFixture(modules)
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Ship",
  })
  let root: Id<"taskComments"> | undefined
  for (let i = 0; i < 21; i++) {
    const commentId = await alice.mutation(api.taskComments.create, {
      taskId,
      body: `Root ${i}`,
      mentions: [],
    })
    root ??= commentId
  }
  const first = await alice.query(api.taskComments.list, {
    taskId,
    paginationOpts: { numItems: 100, cursor: null },
  })
  expect(first.page).toHaveLength(20)
  expect(first.isDone).toBe(false)
  const second = await alice.query(api.taskComments.list, {
    taskId,
    paginationOpts: { numItems: 20, cursor: first.continueCursor },
  })
  expect(second.page).toHaveLength(1)

  for (let i = 0; i < 11; i++) {
    await alice.mutation(api.taskComments.reply, {
      commentId: root!,
      body: `Reply ${i}`,
      mentions: [],
    })
  }
  const replies = await alice.query(api.taskComments.list, {
    taskId,
    parentCommentId: root!,
    paginationOpts: { numItems: 20, cursor: null },
  })
  expect(replies.page).toHaveLength(10)
  expect(replies.isDone).toBe(false)

  await expect(
    alice.mutation(api.taskComments.create, {
      taskId,
      body: "Hi @Stranger",
      mentions: [
        { start: 3, length: 9, subject: "stranger", label: "Stranger" },
      ],
    })
  ).rejects.toThrow()
})

test("outsiders cannot read or mutate task children", async () => {
  const { t, alice } = await organizationFixture(modules)
  const charlie = t.withIdentity({
    name: "Charlie",
    subject: "charlie",
    tokenIdentifier: "charlie",
  })
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Ship",
  })
  await expect(charlie.query(api.subtasks.list, { taskId })).rejects.toThrow()
  await expect(
    charlie.mutation(api.taskComments.create, {
      taskId,
      body: "No access",
      mentions: [],
    })
  ).rejects.toThrow()
})

test("tombstone-only tasks still require cascade acknowledgement", async () => {
  const { alice } = await organizationFixture(modules)
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Ship",
  })
  const commentId = await alice.mutation(api.taskComments.create, {
    taskId,
    body: "Delete me",
    mentions: [],
  })
  await alice.mutation(api.taskComments.remove, { commentId })
  expect(
    (await alice.query(api.tasks.get, { taskId }))?.activeCommentCount
  ).toBe(0)
  await expect(alice.mutation(api.tasks.remove, { taskId })).rejects.toThrow()
})

test("project deletion drains task children and stats in scheduled batches", async () => {
  const { t, alice } = await organizationFixture(modules)
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Ship",
  })
  await alice.mutation(api.subtasks.create, { taskId, title: "Child" })
  await alice.mutation(api.taskComments.create, {
    taskId,
    body: "Comment",
    mentions: [],
  })
  await alice.mutation(api.projects.remove, { projectId })
  await t.mutation(internal.projects.purgeProjectData, { projectId })
  await t.mutation(internal.tasks.purgeTaskData, { taskId })
  const remaining = await t.run(async (ctx) => ({
    subtasks: await ctx.db.query("subtasks").collect(),
    comments: await ctx.db.query("taskComments").collect(),
    stats: await ctx.db.query("taskStats").collect(),
  }))
  expect(remaining).toEqual({ subtasks: [], comments: [], stats: [] })
})
