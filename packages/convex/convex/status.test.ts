/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"

import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")

function setup() {
  const t = convexTest(schema, modules)
  const alice = t.withIdentity({
    name: "Alice",
    email: "alice@example.com",
    subject: "alice",
    tokenIdentifier: "alice",
  })
  const bob = t.withIdentity({
    name: "Bob",
    email: "bob@example.com",
    subject: "bob",
    tokenIdentifier: "bob",
  })
  return { t, alice, bob }
}

test("status requires authentication", async () => {
  const t = convexTest(schema, modules)
  await expect(t.query(api.agent.status, {})).rejects.toThrow()
})

test("status returns the caller's identity from the auth token", async () => {
  const { alice } = setup()
  const status = await alice.query(api.agent.status, {})
  expect(status.identity).toEqual({ name: "Alice", email: "alice@example.com" })
})

test("status reports owned vs shared project counts", async () => {
  const { alice, bob } = setup()
  // Alice owns two projects.
  await alice.mutation(api.projects.create, { name: "Alpha" })
  const beta = await alice.mutation(api.projects.create, { name: "Beta" })
  // Bob owns one and joins Beta as an editor.
  await bob.mutation(api.projects.create, { name: "Gamma" })
  const token = await alice.mutation(api.invites.ensure, { projectId: beta })
  await bob.mutation(api.invites.accept, { token })

  const aliceStatus = await alice.query(api.agent.status, {})
  expect(aliceStatus.workspace).toMatchObject({
    projects: 2,
    ownedProjects: 2,
    sharedProjects: 0,
  })

  const bobStatus = await bob.query(api.agent.status, {})
  expect(bobStatus.workspace).toMatchObject({
    projects: 2,
    ownedProjects: 1,
    sharedProjects: 1,
  })
})

test("status totals open (todo + in-progress) tasks, excluding done", async () => {
  const { alice } = setup()
  const projectId = await alice.mutation(api.projects.create, { name: "Alpha" })

  const todo = await alice.mutation(api.tasks.create, { projectId, title: "Todo task" })
  const inProgress = await alice.mutation(api.tasks.create, { projectId, title: "Doing task" })
  const finished = await alice.mutation(api.tasks.create, { projectId, title: "Done task" })

  await alice.mutation(api.tasks.move, { taskId: inProgress, status: "inProgress" })
  await alice.mutation(api.tasks.move, { taskId: finished, status: "done" })
  // Keep `todo` in the todo column.
  expect(todo).toBeDefined()

  const status = await alice.query(api.agent.status, {})
  // Two open tasks (todo + inProgress); the done task is excluded.
  expect(status.workspace.openTasks).toBe(2)
})
