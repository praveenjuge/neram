/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { api } from "./_generated/api"
import { organizationFixture } from "../test-utils/organization"

const modules = import.meta.glob("./**/*.ts")

// Drive the clock so each mutation stamps a distinct updatedAt; otherwise
// operations inside a single millisecond tie and the ordering isn't observable.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_000)
})
afterEach(() => {
  vi.useRealTimers()
})

test("projects.list surfaces the most recently updated project first", async () => {
  const { alice } = await organizationFixture(modules)
  const alpha = await alice.mutation(api.projects.create, { name: "Alpha" })
  vi.setSystemTime(2_000)
  await alice.mutation(api.projects.create, { name: "Beta" })
  vi.setSystemTime(3_000)
  await alice.mutation(api.projects.create, { name: "Gamma" })

  // Editing Alpha bumps its updatedAt to the newest, so it should jump to the
  // front of the list even though it was created first.
  vi.setSystemTime(4_000)
  await alice.mutation(api.projects.update, {
    projectId: alpha,
    name: "Alpha v2",
  })

  const list = await alice.query(api.projects.list, {})
  expect(list[0]._id).toBe(alpha)
  expect(list[0].name).toBe("Alpha v2")
})

test("creating a task bumps its project to the top of the list", async () => {
  const { alice } = await organizationFixture(modules)
  await alice.mutation(api.projects.create, { name: "Alpha" })
  vi.setSystemTime(2_000)
  const beta = await alice.mutation(api.projects.create, { name: "Beta" })

  // Adding a task patches the project's updatedAt, so Beta moves ahead.
  vi.setSystemTime(3_000)
  await alice.mutation(api.tasks.create, { projectId: beta, title: "Ship it" })

  const list = await alice.query(api.projects.list, {})
  expect(list[0]._id).toBe(beta)
})

test("editing a task bumps its project to the top of the list", async () => {
  const { alice } = await organizationFixture(modules)
  const alpha = await alice.mutation(api.projects.create, { name: "Alpha" })
  const taskId = await alice.mutation(api.tasks.create, {
    projectId: alpha,
    title: "Ship it",
  })
  vi.setSystemTime(2_000)
  const beta = await alice.mutation(api.projects.create, { name: "Beta" })
  // Beta is now the most recently updated project.
  expect((await alice.query(api.projects.list, {}))[0]._id).toBe(beta)

  // Editing Alpha's task must bump Alpha's updatedAt so it moves back to top.
  vi.setSystemTime(3_000)
  await alice.mutation(api.tasks.update, { taskId, title: "Ship it now" })

  const list = await alice.query(api.projects.list, {})
  expect(list[0]._id).toBe(alpha)
})
