/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"

import { api, internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")

async function setup() {
  const t = convexTest(schema, modules)
  await t.mutation(internal.organizations.upsertOrganization, {
    organizationId: "org_acme",
    slug: "acme",
    name: "Acme",
  })
  for (const [userId, role, displayName] of [
    ["alice", "org:admin", "Alice"],
    ["bob", "org:member", "Bob"],
  ] as const) {
    await t.mutation(internal.organizations.upsertMember, {
      organizationId: "org_acme",
      membershipId: `mem_${userId}`,
      userId,
      role,
      displayName,
    })
  }
  const alice = t.withIdentity({
    name: "Alice",
    email: "alice@example.com",
    subject: "alice",
    tokenIdentifier: "alice",
    org_id: "org_acme",
    org_slug: "acme",
    org_role: "org:admin",
  })
  const bob = t.withIdentity({
    name: "Bob",
    email: "bob@example.com",
    subject: "bob",
    tokenIdentifier: "bob",
    org_id: "org_acme",
    org_slug: "acme",
    org_role: "org:member",
  })
  return { t, alice, bob }
}

test("status requires authentication", async () => {
  const t = convexTest(schema, modules)
  await expect(t.query(api.agent.status, {})).rejects.toThrow()
})

test("status returns the caller's identity from the auth token", async () => {
  const { alice } = await setup()
  const status = await alice.query(api.agent.status, {})
  expect(status.identity).toEqual({ name: "Alice", email: "alice@example.com" })
})

test("status reports Organization-wide project counts", async () => {
  const { alice, bob } = await setup()
  await alice.mutation(api.projects.create, { name: "Alpha" })
  await alice.mutation(api.projects.create, { name: "Beta" })
  await bob.mutation(api.projects.create, { name: "Gamma" })

  const aliceStatus = await alice.query(api.agent.status, {})
  expect(aliceStatus).toMatchObject({
    organization: { organizationId: "org_acme", role: "org:admin" },
    workspace: { projects: 3 },
  })

  const bobStatus = await bob.query(api.agent.status, {})
  expect(bobStatus).toMatchObject({
    organization: { organizationId: "org_acme", role: "org:member" },
    workspace: { projects: 3 },
  })
})

test("status totals open (todo + in-progress) tasks, excluding done", async () => {
  const { alice } = await setup()
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
