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

const allItems = { paginationOpts: { numItems: 50, cursor: null } }

test("accept adds the caller as an editor and shares the project", async () => {
  const { alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const token = await alice.mutation(api.invites.ensure, { projectId })

  const joined = await bob.mutation(api.invites.accept, { token })
  expect(joined).toEqual(projectId)

  const members = await bob.query(api.members.list, { projectId })
  expect(members).toHaveLength(2)
  const editor = members.find((member) => member.role === "editor")
  expect(editor?.displayName).toBe("Bob")
  expect(editor?.isYou).toBe(true)

  // The shared project now shows up on Bob's dashboard tagged as editor.
  const bobProjects = await bob.query(api.projects.list, {})
  expect(bobProjects).toHaveLength(1)
  expect(bobProjects[0].role).toBe("editor")
})

test("accept is idempotent for an existing member", async () => {
  const { alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, { name: "Roadmap" })
  const token = await alice.mutation(api.invites.ensure, { projectId })

  await bob.mutation(api.invites.accept, { token })
  await bob.mutation(api.invites.accept, { token })

  const members = await alice.query(api.members.list, { projectId })
  expect(members.filter((member) => member.role === "editor")).toHaveLength(1)
})

test("editors can add tasks but cannot delete the project", async () => {
  const { alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const token = await alice.mutation(api.invites.ensure, { projectId })
  await bob.mutation(api.invites.accept, { token })

  await bob.mutation(api.tasks.create, { projectId, title: "Ship it" })
  const tasks = await bob.query(api.tasks.list, { projectId })
  expect(tasks).toHaveLength(1)
  expect(tasks[0].title).toBe("Ship it")

  await expect(
    bob.mutation(api.projects.remove, { projectId })
  ).rejects.toThrow()
})

test("owner-only functions reject non-owners", async () => {
  const { alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const token = await alice.mutation(api.invites.ensure, { projectId })
  await bob.mutation(api.invites.accept, { token })

  await expect(
    bob.mutation(api.invites.regenerate, { projectId })
  ).rejects.toThrow()
  await expect(
    bob.mutation(api.invites.revoke, { projectId })
  ).rejects.toThrow()
  await expect(
    bob.mutation(api.members.remove, { projectId, subject: "alice" })
  ).rejects.toThrow()
})

test("the owner cannot leave their own project", async () => {
  const { alice } = setup()
  const projectId = await alice.mutation(api.projects.create, { name: "Roadmap" })
  await expect(
    alice.mutation(api.members.leave, { projectId })
  ).rejects.toThrow()
})

test("preview returns null after the token is revoked", async () => {
  const { alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const token = await alice.mutation(api.invites.ensure, { projectId })

  expect(await bob.query(api.invites.preview, { token })).not.toBeNull()

  await alice.mutation(api.invites.revoke, { projectId })
  expect(await bob.query(api.invites.preview, { token })).toBeNull()
})

test("activity fans out exactly one row per recipient", async () => {
  const { t, alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const token = await alice.mutation(api.invites.ensure, { projectId })

  // member.joined -> rows for alice + bob; task.created -> rows for alice + bob.
  await bob.mutation(api.invites.accept, { token })
  await bob.mutation(api.tasks.create, { projectId, title: "Ship it" })

  const aliceFeed = await alice.query(api.activity.list, allItems)
  const bobFeed = await bob.query(api.activity.list, allItems)
  expect(aliceFeed.page).toHaveLength(2)
  expect(bobFeed.page).toHaveLength(2)

  const all = await t.run((ctx) => ctx.db.query("activity").collect())
  expect(all).toHaveLength(4)

  const taskRows = all.filter((row) => row.type === "task.created")
  expect(taskRows).toHaveLength(2)
  expect(new Set(taskRows.map((row) => row.subject))).toEqual(
    new Set(["alice", "bob"])
  )
})

test("removed members lose access to the board", async () => {
  const { alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, { name: "Roadmap" })
  const token = await alice.mutation(api.invites.ensure, { projectId })
  await bob.mutation(api.invites.accept, { token })

  await alice.mutation(api.members.remove, { projectId, subject: "bob" })

  expect(await bob.query(api.projects.get, { projectId })).toBeNull()
  expect(await bob.query(api.projects.list, {})).toHaveLength(0)
  await expect(bob.query(api.tasks.list, { projectId })).rejects.toThrow()
})
