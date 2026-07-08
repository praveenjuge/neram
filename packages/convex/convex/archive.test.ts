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

test("archiving hides a project from the active lists and shows it in listArchived", async () => {
  const { alice } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })

  await alice.mutation(api.projects.archive, { projectId })

  // Gone from the dashboard list and the sidebar names list.
  expect(await alice.query(api.projects.list, {})).toHaveLength(0)
  expect(await alice.query(api.projects.names, {})).toHaveLength(0)

  // Present on the Archived page.
  const archived = await alice.query(api.projects.listArchived, {})
  expect(archived).toHaveLength(1)
  expect(archived[0]._id).toBe(projectId)
})

test("unarchiving restores a project to the active lists", async () => {
  const { alice } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  await alice.mutation(api.projects.archive, { projectId })
  await alice.mutation(api.projects.unarchive, { projectId })

  expect(await alice.query(api.projects.list, {})).toHaveLength(1)
  expect(await alice.query(api.projects.listArchived, {})).toHaveLength(0)
})

test("archived projects disappear from a collaborator's lists too", async () => {
  const { alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const token = await alice.mutation(api.invites.ensure, { projectId })
  await bob.mutation(api.invites.accept, { token })

  await alice.mutation(api.projects.archive, { projectId })

  // The collaborator no longer sees the archived project on their dashboard,
  // and it never shows on their Archived page (archiving is owner-scoped).
  expect(await bob.query(api.projects.list, {})).toHaveLength(0)
  expect(await bob.query(api.projects.listArchived, {})).toHaveLength(0)
})

test("only the owner can archive or unarchive", async () => {
  const { alice, bob } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  const token = await alice.mutation(api.invites.ensure, { projectId })
  await bob.mutation(api.invites.accept, { token })

  await expect(
    bob.mutation(api.projects.archive, { projectId })
  ).rejects.toThrow()
  await expect(
    bob.mutation(api.projects.unarchive, { projectId })
  ).rejects.toThrow()
})

test("listArchived returns an archived project even behind many newer active projects", async () => {
  const { alice } = setup()

  // Archive a project first, so its archivedAt/updatedAt is the oldest.
  const archivedId = await alice.mutation(api.projects.create, {
    name: "Old archived",
  })
  await alice.mutation(api.projects.archive, { projectId: archivedId })

  // Then create a batch of active projects, each with a newer updatedAt. With a
  // naive "take newest, then filter archived" approach these would crowd the
  // archived one out of a bounded read; the archived index slice avoids that.
  for (let i = 0; i < 25; i++) {
    await alice.mutation(api.projects.create, { name: `Active ${i}` })
  }

  const archived = await alice.query(api.projects.listArchived, {})
  expect(archived.map((p) => p._id)).toContain(archivedId)
  // Active projects never leak into the archived list.
  expect(archived).toHaveLength(1)
})
