/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import type { FunctionReturnType } from "convex/server"
import { expect, test } from "vitest"

import { api } from "./_generated/api"
import schema from "./schema"

type ArchivedResult = FunctionReturnType<typeof api.projects.listArchived>

const modules = import.meta.glob("./**/*.ts")

// listArchived is paginated; grab a generous first page in tests.
const firstPage = { paginationOpts: { numItems: 50, cursor: null } }

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
  const archived = await alice.query(api.projects.listArchived, firstPage)
  expect(archived.page).toHaveLength(1)
  expect(archived.page[0]._id).toBe(projectId)
})

test("unarchiving restores a project to the active lists", async () => {
  const { alice } = setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
  })
  await alice.mutation(api.projects.archive, { projectId })
  await alice.mutation(api.projects.unarchive, { projectId })

  expect(await alice.query(api.projects.list, {})).toHaveLength(1)
  const archived = await alice.query(api.projects.listArchived, firstPage)
  expect(archived.page).toHaveLength(0)
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
  const bobArchived = await bob.query(api.projects.listArchived, firstPage)
  expect(bobArchived.page).toHaveLength(0)
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

  const archived = await alice.query(api.projects.listArchived, firstPage)
  expect(archived.page.map((p) => p._id)).toContain(archivedId)
  // Active projects never leak into the archived list.
  expect(archived.page).toHaveLength(1)
})

test("listArchived paginates across every archived project", async () => {
  const { alice } = setup()

  // Archive several projects so more than one page is needed.
  for (let i = 0; i < 5; i++) {
    const id = await alice.mutation(api.projects.create, { name: `Old ${i}` })
    await alice.mutation(api.projects.archive, { projectId: id })
  }

  // Walk the pages with a small page size and collect every archived project.
  const seen = new Set<string>()
  let cursor: string | null = null
  for (let guard = 0; guard < 10; guard++) {
    const result: ArchivedResult = await alice.query(
      api.projects.listArchived,
      { paginationOpts: { numItems: 2, cursor } }
    )
    for (const project of result.page) seen.add(project._id)
    if (result.isDone) break
    cursor = result.continueCursor
  }

  expect(seen.size).toBe(5)
})
