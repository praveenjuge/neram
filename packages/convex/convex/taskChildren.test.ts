/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"

import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const firstPage = { paginationOpts: { numItems: 20, cursor: null } }

function setup() {
  const t = convexTest(schema, modules)
  const alice = t.withIdentity({
    name: "Alice",
    subject: "alice",
    tokenIdentifier: "alice",
  })
  const bob = t.withIdentity({
    name: "Bob",
    subject: "bob",
    tokenIdentifier: "bob",
  })
  return { t, alice, bob }
}

async function sharedProject() {
  const { t, alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, { name: "Roadmap" })
  const token = await alice.mutation(api.invites.ensure, { projectId })
  await bob.mutation(api.invites.accept, { token })
  return { t, alice, bob, projectId }
}

test("missing taskStats is canonically zero", async () => {
  const { alice } = setup()
  const projectId = await alice.mutation(api.projects.create, { name: "Roadmap" })
  const taskId = await alice.mutation(api.tasks.create, { projectId, title: "Ship" })

  await expect(alice.query(api.tasks.get, { taskId })).resolves.toMatchObject({
    totalSubtasks: 0,
    completedSubtasks: 0,
    activeCommentCount: 0,
  })
})

test("editors manage ordered subtasks and counters stay correct", async () => {
  const { alice, bob, projectId } = await sharedProject()
  const taskId = await alice.mutation(api.tasks.create, { projectId, title: "Ship" })
  const first = await bob.mutation(api.subtasks.create, { taskId, title: "First" })
  const second = await bob.mutation(api.subtasks.create, { taskId, title: "Second" })
  const third = await bob.mutation(api.subtasks.create, { taskId, title: "Third" })

  await bob.mutation(api.subtasks.reorder, {
    subtaskId: third,
    beforeSubtaskId: first,
  })
  expect((await alice.query(api.subtasks.list, { taskId })).map((row) => row.title)).toEqual([
    "Third",
    "First",
    "Second",
  ])

  await bob.mutation(api.subtasks.rename, { subtaskId: first, title: "Renamed" })
  await bob.mutation(api.subtasks.setCompleted, { subtaskId: second, completed: true })
  await bob.mutation(api.subtasks.remove, { subtaskId: first })
  await expect(alice.query(api.tasks.get, { taskId })).resolves.toMatchObject({
    totalSubtasks: 2,
    completedSubtasks: 1,
  })
})

test("completion requires explicit acknowledgement when subtasks remain", async () => {
  const { alice } = setup()
  const projectId = await alice.mutation(api.projects.create, { name: "Roadmap" })
  const taskId = await alice.mutation(api.tasks.create, { projectId, title: "Ship" })
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
  const { alice, bob, projectId } = await sharedProject()
  const taskId = await alice.mutation(api.tasks.create, { projectId, title: "Ship" })
  const root = await alice.mutation(api.taskComments.create, {
    taskId,
    body: "Hi @Bob",
    mentions: [{ start: 3, length: 4, subject: "bob", label: "Bob" }],
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

  const roots = await alice.query(api.taskComments.list, { taskId, ...firstPage })
  expect(roots.page.map((row) => row._id)).toEqual([root])
  const replies = await alice.query(api.taskComments.list, {
    taskId,
    parentCommentId: root,
    paginationOpts: { numItems: 20, cursor: null },
  })
  expect(replies.page.map((row) => row._id)).toEqual([reply])
  expect((await alice.query(api.taskComments.getAncestry, { commentId: nested })).comments.map((row) => row._id)).toEqual([
    root,
    reply,
    nested,
  ])

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

test("comment edit permissions and owner tombstones preserve descendants", async () => {
  const { alice, bob, projectId } = await sharedProject()
  const taskId = await alice.mutation(api.tasks.create, { projectId, title: "Ship" })
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

  const roots = await alice.query(api.taskComments.list, { taskId, ...firstPage })
  expect(roots.page[0]).toMatchObject({ body: "", deletedAt: expect.any(Number) })
  const detail = await alice.query(api.tasks.get, { taskId })
  expect(detail?.activeCommentCount).toBe(1)
})

test("moving tasks carries children and cascade deletion requires acknowledgement", async () => {
  const { alice } = setup()
  const from = await alice.mutation(api.projects.create, { name: "From" })
  const to = await alice.mutation(api.projects.create, { name: "To" })
  const taskId = await alice.mutation(api.tasks.create, { projectId: from, title: "Ship" })
  await alice.mutation(api.subtasks.create, { taskId, title: "Verify" })
  await alice.mutation(api.taskComments.create, { taskId, body: "Ready", mentions: [] })

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
