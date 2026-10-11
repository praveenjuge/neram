/// <reference types="vite/client" />
import { ConvexError, convexToJson } from "convex/values"
import type { Value } from "convex/values"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { api, internal } from "./_generated/api"
import { organizationFixture } from "../test-utils/organization"

// Native clients (apps/apple, apps/android) decode Convex results into
// hand-written models. These fixtures record the exact JSON each function
// returns over the wire so the native test suites can decode them and fail
// when a backend shape changes. Update with `vitest run -u`.

const modules = import.meta.glob("./**/*.ts")
const firstPage = { paginationOpts: { numItems: 20, cursor: null } }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"))
})

afterEach(() => {
  vi.useRealTimers()
})

async function fixture(name: string, value: unknown) {
  await expect(
    `${JSON.stringify(convexToJson(value as Value), null, 2)}\n`
  ).toMatchFileSnapshot(`../fixtures/${name}.json`)
}

async function errorData(call: Promise<unknown>) {
  try {
    await call
  } catch (error) {
    if (error instanceof ConvexError) return error.data
    throw error
  }
  throw new Error("Expected a ConvexError")
}

test("client contract fixtures", async () => {
  const { t, alice, bob } = await organizationFixture(modules)

  const projectId = await alice.mutation(api.projects.create, {
    name: "Roadmap",
    icon: "folder-kanban",
    color: "lime",
  })
  const archivedId = await alice.mutation(api.projects.create, {
    name: "Old launch",
  })
  await alice.mutation(api.projects.archive, { projectId: archivedId })

  const assigned = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Write the launch post",
    description: "Cover the native apps.",
    dueDate: "2026-01-20",
    assigneeSubject: "user_bob",
  })
  const active = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Review designs",
  })
  await alice.mutation(api.tasks.move, {
    taskId: active,
    status: "inProgress",
  })
  const finished = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Pick a name",
  })

  const outline = await alice.mutation(api.subtasks.create, {
    taskId: assigned,
    title: "Outline",
  })
  await alice.mutation(api.subtasks.create, {
    taskId: assigned,
    title: "Draft",
  })
  await alice.mutation(api.subtasks.setCompleted, {
    subtaskId: outline,
    completed: true,
  })

  // "Thanks 👋 @Bob": the emoji is two UTF-16 code units, so the mention
  // starts at 10, not 9. Native clients must count UTF-16 code units.
  const rootComment = await alice.mutation(api.taskComments.create, {
    taskId: assigned,
    body: "Thanks 👋 @Bob",
    mentions: [{ start: 10, length: 4, subject: "user_bob", label: "Bob" }],
  })
  const reply = await bob.mutation(api.taskComments.reply, {
    commentId: rootComment,
    body: "On it.",
    mentions: [],
  })

  await alice.mutation(api.sprints.start, { goal: "Ship the cutover" })
  await alice.mutation(api.sprints.plan, { taskIds: [active, finished] })
  await alice.mutation(api.tasks.move, { taskId: finished, status: "done" })
  const rolloverId = await alice.mutation(api.sprints.end, { confirm: true })
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const complete = await t.run(
      async (ctx) => (await ctx.db.get(rolloverId))?.status === "completed"
    )
    if (complete) break
    await t.mutation(internal.sprintRollover.process, { jobId: rolloverId })
  }
  await alice.mutation(api.sprints.start, { duration: 1 })
  await alice.mutation(api.sprints.plan, { taskIds: [active] })

  await fixture(
    "organizations.current",
    await alice.query(api.organizations.current, {})
  )
  await fixture(
    "organizations.members",
    await alice.query(api.organizations.members, firstPage)
  )
  await fixture("projects.list", await alice.query(api.projects.list, {}))
  await fixture("projects.names", await alice.query(api.projects.names, {}))
  await fixture(
    "projects.get",
    await alice.query(api.projects.get, { projectId })
  )
  await fixture(
    "projects.listArchived",
    await alice.query(api.projects.listArchived, firstPage)
  )
  await fixture("tasks.list", await alice.query(api.tasks.list, { projectId }))
  await fixture(
    "tasks.listAll",
    await alice.query(api.tasks.listAll, { assignedToMe: false })
  )
  await fixture(
    "tasks.get",
    await alice.query(api.tasks.get, { taskId: assigned })
  )
  await fixture(
    "subtasks.list",
    await alice.query(api.subtasks.list, { taskId: assigned })
  )
  await fixture(
    "taskComments.list",
    await alice.query(api.taskComments.list, {
      taskId: assigned,
      ...firstPage,
    })
  )
  await fixture(
    "taskComments.getAncestry",
    await alice.query(api.taskComments.getAncestry, { commentId: reply })
  )
  await fixture("sprints.current", await alice.query(api.sprints.current, {}))
  await fixture("sprints.backlog", await alice.query(api.sprints.backlog, {}))
  await fixture(
    "sprints.history",
    await alice.query(api.sprints.history, firstPage)
  )
  await fixture(
    "activity.list",
    await bob.query(api.activity.list, firstPage)
  )

  await fixture("errors.EDIT_CONFLICT", {
    ...(await errorData(
      alice.mutation(api.tasks.update, {
        taskId: assigned,
        title: "Mine",
        expectedTitle: "Stale title",
      })
    )),
  })
  await fixture(
    "errors.INCOMPLETE_SUBTASKS",
    await errorData(
      alice.mutation(api.tasks.move, { taskId: assigned, status: "done" })
    )
  )
  await fixture(
    "errors.CASCADE_CONFIRMATION_REQUIRED",
    await errorData(alice.mutation(api.tasks.remove, { taskId: assigned }))
  )
})
