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

/** Read every personal work state row, regardless of owner, for assertions. */
function allWorkStates(t: ReturnType<typeof setup>["t"]) {
  return t.run((ctx) => ctx.db.query("projectWorkStates").collect())
}

test("creating a project does not create a personal work state", async () => {
  const { t, alice } = setup()
  await alice.mutation(api.projects.create, { name: "Roadmap" })

  // A fresh project starts with no personal recency: it lands in "Needs love".
  expect(await allWorkStates(t)).toHaveLength(0)
  const list = await alice.query(api.projects.list, {})
  expect(list).toHaveLength(1)
  expect(list[0].lastWorkedAt).toBeUndefined()
})

test("markWorked requires project access", async () => {
  const { alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })

  // Bob is not a member, so he cannot check in on Alice's project.
  await expect(
    bob.mutation(api.projects.markWorked, { projectId })
  ).rejects.toThrow()
  const list = await alice.query(api.projects.list, {})
  expect(list[0].lastWorkedAt).toBeUndefined()
})

test("markWorked only updates the caller's own work state", async () => {
  const { t, alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const token = await alice.mutation(api.invites.ensure, { projectId })
  await bob.mutation(api.invites.accept, { token })

  const stamp = await alice.mutation(api.projects.markWorked, { projectId })
  expect(typeof stamp).toBe("number")

  const states = await allWorkStates(t)
  expect(states).toHaveLength(1)
  expect(states[0].subject).toBe("alice")
  expect(states[0].projectId).toBe(projectId)

  // Alice sees her personal recency; Bob's view of the shared project does not.
  const aliceList = await alice.query(api.projects.list, {})
  expect(aliceList[0].lastWorkedAt).toBe(stamp)
  const bobList = await bob.query(api.projects.list, {})
  expect(bobList[0].lastWorkedAt).toBeUndefined()
})

test("markWorked is latest-only and overwrites the existing row", async () => {
  const { t, alice } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })

  const first = await alice.mutation(api.projects.markWorked, { projectId })
  const second = await alice.mutation(api.projects.markWorked, { projectId })

  const states = await allWorkStates(t)
  expect(states).toHaveLength(1)
  expect(second).toBeGreaterThanOrEqual(first)
  expect(states[0].lastWorkedAt).toBe(second)
})

test("editing a project marks the actor's work state", async () => {
  const { t, alice } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })

  await alice.mutation(api.projects.update, { projectId, name: "Roadmap v2" })

  const states = await allWorkStates(t)
  expect(states).toHaveLength(1)
  expect(states[0].subject).toBe("alice")
  expect(states[0].projectId).toBe(projectId)
})

test("task mutations update only the acting member's work state", async () => {
  const { t, alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const token = await alice.mutation(api.invites.ensure, { projectId })
  await bob.mutation(api.invites.accept, { token })

  // Bob (a collaborator) does the work; only Bob's recency should move.
  const taskId = await bob.mutation(api.tasks.create, {
    projectId,
    title: "Ship it",
  })
  await bob.mutation(api.tasks.update, { taskId, title: "Ship it now" })
  await bob.mutation(api.tasks.move, { taskId, status: "inProgress" })

  const states = await allWorkStates(t)
  expect(states).toHaveLength(1)
  expect(states[0].subject).toBe("bob")
})

test("a collaborator's work does not move the owner's personal recency", async () => {
  const { alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const token = await alice.mutation(api.invites.ensure, { projectId })
  await bob.mutation(api.invites.accept, { token })

  // Bob works on the shared project repeatedly.
  await bob.mutation(api.tasks.create, { projectId, title: "Ship it" })
  await bob.mutation(api.projects.markWorked, { projectId })

  // Alice has never personally checked in, so her dashboard still needs love.
  const aliceList = await alice.query(api.projects.list, {})
  expect(aliceList[0].lastWorkedAt).toBeUndefined()

  // Bob, who did the work, sees his own recency on the same shared project.
  const bobList = await bob.query(api.projects.list, {})
  expect(bobList[0].lastWorkedAt).toBeDefined()
})

test("projects.list orders dated projects above never-worked ones", async () => {
  const { alice } = setup()
  await alice.mutation(api.projects.create, { name: "Alpha" })
  const beta = await alice.mutation(api.projects.create, { name: "Beta" })
  await alice.mutation(api.projects.create, { name: "Gamma" })

  // Only Beta has personal recency; it should sort to the front.
  await alice.mutation(api.projects.markWorked, { projectId: beta })

  const list = await alice.query(api.projects.list, {})
  expect(list[0]._id).toBe(beta)
  expect(list[0].lastWorkedAt).toBeDefined()
  // The remaining projects have no personal state and sort after the dated one.
  expect(list.slice(1).every((p) => p.lastWorkedAt === undefined)).toBe(true)
})

test("removing a project purges every member's personal work state", async () => {
  const { t, alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const token = await alice.mutation(api.invites.ensure, { projectId })
  await bob.mutation(api.invites.accept, { token })

  // Both members build up personal recency on the shared project.
  await alice.mutation(api.projects.markWorked, { projectId })
  await bob.mutation(api.projects.markWorked, { projectId })
  expect(await allWorkStates(t)).toHaveLength(2)

  // Deleting the project must not leave orphaned work-state rows behind, or
  // they'd accumulate under each subject and crowd out the bounded read.
  await alice.mutation(api.projects.remove, { projectId })
  expect(await allWorkStates(t)).toHaveLength(0)
})

test("leaving a project clears the departing member's work state", async () => {
  const { t, alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const token = await alice.mutation(api.invites.ensure, { projectId })
  await bob.mutation(api.invites.accept, { token })

  await alice.mutation(api.projects.markWorked, { projectId })
  await bob.mutation(api.projects.markWorked, { projectId })
  expect(await allWorkStates(t)).toHaveLength(2)

  // Bob leaves: only his row goes; Alice (owner) keeps her recency.
  await bob.mutation(api.members.leave, { projectId })
  const remaining = await allWorkStates(t)
  expect(remaining).toHaveLength(1)
  expect(remaining[0].subject).toBe("alice")
})
