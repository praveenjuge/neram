/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"

import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const page = { paginationOpts: { numItems: 100, cursor: null } }

async function addOrganization(
  t: ReturnType<typeof convexTest<typeof schema extends never ? never : never>>,
  organizationId: string,
  slug: string,
  users: Array<{
    userId: string
    role: "org:admin" | "org:member"
    name: string
  }>
) {
  await t.mutation(internal.organizations.upsertOrganization, {
    organizationId,
    slug,
    name: `${slug} Workspace`,
  })
  for (const user of users) {
    await t.mutation(internal.organizations.upsertMember, {
      organizationId,
      membershipId: `mem_${organizationId}_${user.userId}`,
      userId: user.userId,
      role: user.role,
      displayName: user.name,
    })
  }
}

function identity(
  t: ReturnType<typeof convexTest>,
  userId: string,
  name: string,
  organizationId: string,
  slug: string,
  role: "org:admin" | "org:member"
) {
  return t.withIdentity({
    subject: userId,
    tokenIdentifier: `https://clerk.test|${userId}`,
    name,
    org_id: organizationId,
    org_slug: slug,
    org_role: role,
  })
}

async function setup() {
  const t = convexTest(schema, modules)
  await addOrganization(t, "org_alpha", "alpha", [
    { userId: "user_alice", role: "org:admin", name: "Alice" },
    { userId: "user_bob", role: "org:member", name: "Bob" },
  ])
  await addOrganization(t, "org_beta", "beta", [
    { userId: "user_carol", role: "org:admin", name: "Carol" },
  ])
  return {
    t,
    alice: identity(
      t,
      "user_alice",
      "Alice",
      "org_alpha",
      "alpha",
      "org:admin"
    ),
    bob: identity(t, "user_bob", "Bob", "org_alpha", "alpha", "org:member"),
    carol: identity(t, "user_carol", "Carol", "org_beta", "beta", "org:admin"),
  }
}

async function finishClose(
  who: Awaited<ReturnType<typeof setup>>["alice"],
  jobId: Id<"sprintRolloverJobs">
) {
  for (let index = 0; index < 10; index += 1) {
    const complete = await who.run(
      async (ctx) => (await ctx.db.get(jobId))?.status === "completed"
    )
    if (complete) return
    await who.mutation(internal.sprintRollover.process, { jobId })
  }
  throw new Error("Sprint close did not complete")
}

test("Sprints are optional and task capture always starts in Backlog", async () => {
  const { alice } = await setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Product",
  })
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Shape the release",
  })

  expect(await alice.query(api.sprints.current, {})).toBeNull()
  await alice.mutation(api.tasks.move, { taskId, status: "inProgress" })
  expect(
    (await alice.query(api.sprints.backlog, {})).find(
      (task) => task._id === taskId
    )?.status
  ).toBe("inProgress")
})

test("only one Sprint can run and duration starts from the moment it begins", async () => {
  const { alice } = await setup()
  const before = Date.now()
  const sprintId = await alice.mutation(api.sprints.start, {
    duration: 1,
    goal: "Ship the cutover",
  })
  const current = await alice.query(api.sprints.current, {})

  expect(current?.sprint._id).toBe(sprintId)
  expect(current?.sprint.startsAt).toBeGreaterThanOrEqual(before)
  expect(current!.sprint.endsAt! - current!.sprint.startsAt).toBe(
    7 * 24 * 60 * 60 * 1000
  )
  expect(current?.sprint.goal).toBe("Ship the cutover")
  await expect(alice.mutation(api.sprints.start, {})).rejects.toThrow()
})

test("open-ended Sprints have no scheduled end and duration affects only the next Sprint", async () => {
  const { alice } = await setup()
  await alice.mutation(api.sprints.updateDuration, { duration: "open" })
  await alice.mutation(api.sprints.start, {})
  const current = await alice.query(api.sprints.current, {})
  const context = await alice.query(api.organizations.current, {})

  expect(current?.sprint.endsAt).toBeUndefined()
  expect(context.settings?.sprintDuration).toBe("open")
  await alice.mutation(api.sprints.updateDuration, { duration: 2 })
  expect(
    (await alice.query(api.sprints.current, {}))?.sprint.endsAt
  ).toBeUndefined()
})

test("members add Backlog work to Current and removal restores active work to Todo", async () => {
  const { alice, bob } = await setup()
  await alice.mutation(api.sprints.start, {})
  const projectId = await alice.mutation(api.projects.create, {
    name: "Product",
  })
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Implement focus",
  })

  await bob.mutation(api.sprints.plan, { taskIds: [taskId] })
  expect(
    (await bob.query(api.sprints.current, {}))?.tasks.map((task) => task._id)
  ).toContain(taskId)
  await bob.mutation(api.tasks.move, { taskId, status: "inProgress" })
  await bob.mutation(api.sprints.remove, { taskIds: [taskId] })

  const backlogTask = (await bob.query(api.sprints.backlog, {})).find(
    (task) => task._id === taskId
  )
  expect(backlogTask?.status).toBe("todo")
  expect(backlogTask?.currentSprintId).toBeUndefined()
})

test("starting work auto-joins Current and completion is credited", async () => {
  const { alice } = await setup()
  await alice.mutation(api.sprints.start, {})
  const projectId = await alice.mutation(api.projects.create, {
    name: "Product",
  })
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Test the workflow",
  })

  await alice.mutation(api.tasks.move, { taskId, status: "inProgress" })
  await alice.mutation(api.tasks.move, { taskId, status: "done" })
  const current = await alice.query(api.sprints.current, {})
  expect(
    current?.tasks.find((task) => task._id === taskId)?.completedAt
  ).toBeDefined()
  await expect(
    alice.mutation(api.sprints.remove, { taskIds: [taskId] })
  ).rejects.toThrow()
})

test("ending snapshots simple progress and returns unfinished work to Backlog", async () => {
  const { alice } = await setup()
  await alice.mutation(api.sprints.start, {})
  const projectId = await alice.mutation(api.projects.create, {
    name: "Product",
  })
  const done = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Done",
  })
  const unfinished = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Still open",
  })
  await alice.mutation(api.sprints.plan, { taskIds: [done, unfinished] })
  await alice.mutation(api.tasks.move, { taskId: done, status: "done" })

  const jobId = await alice.mutation(api.sprints.end, { confirm: true })
  await finishClose(alice, jobId)

  expect(await alice.query(api.sprints.current, {})).toBeNull()
  const backlogIds = (await alice.query(api.sprints.backlog, {})).map(
    (task) => task._id
  )
  expect(backlogIds).toContain(unfinished)
  expect(backlogIds).not.toContain(done)
  const history = await alice.query(api.sprints.history, page)
  expect(history.page[0]).toMatchObject({
    baselineCount: 2,
    completedCount: 1,
  })
  expect(history.page[0]).not.toHaveProperty("carriedCount")

  await alice.mutation(api.sprints.start, {})
  expect((await alice.query(api.sprints.current, {}))?.tasks).toEqual([])
})

test("Sprint planning preserves tenant isolation", async () => {
  const { alice, carol } = await setup()
  await alice.mutation(api.sprints.start, {})
  const projectId = await alice.mutation(api.projects.create, {
    name: "Private",
  })
  const taskId = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Secret",
  })
  await expect(
    carol.mutation(api.sprints.plan, { taskIds: [taskId] })
  ).rejects.toThrow()
})

test("approved migration returns future work to Backlog and removes only future Sprint data", async () => {
  const { t, alice } = await setup()
  const currentId = await alice.mutation(api.sprints.start, {})
  const projectId = await alice.mutation(api.projects.create, {
    name: "Product",
  })
  const currentTask = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Current work",
  })
  await alice.mutation(api.sprints.plan, { taskIds: [currentTask] })

  const { futureId, futureTask } = await t.run(async (ctx) => {
    const now = Date.now()
    const futureId = await ctx.db.insert("sprints", {
      organizationId: "org_alpha",
      number: 99,
      state: "upcoming",
      startsAt: now + 1000,
      endsAt: now + 2000,
      createdAt: now,
      updatedAt: now,
    })
    const futureTask = await ctx.db.insert("tasks", {
      organizationId: "org_alpha",
      projectId,
      title: "Future work",
      status: "todo",
      upcomingSprintId: futureId,
      position: now,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("sprintTaskEntries", {
      organizationId: "org_alpha",
      sprintId: futureId,
      taskId: futureTask,
      projectId,
      projectNameSnapshot: "Product",
      taskTitleSnapshot: "Future work",
      origin: "planned",
      actorUserId: "user_alice",
      actorName: "Alice",
      addedAt: now,
    })
    return { futureId, futureTask }
  })

  expect(
    (await alice.query(api.sprints.backlog, {})).map((task) => task._id)
  ).toContain(futureTask)

  for (let index = 0; index < 4; index += 1) {
    await alice.mutation(internal.sprintMigration.cleanupSprint, {
      sprintId: futureId,
    })
  }
  const state = await t.run(async (ctx) => ({
    future: await ctx.db.get(futureId),
    current: await ctx.db.get(currentId),
    task: await ctx.db.get(futureTask),
    entries: await ctx.db
      .query("sprintTaskEntries")
      .withIndex("by_sprint_and_added_at", (q) => q.eq("sprintId", futureId))
      .take(10),
  }))
  expect(state.future).toBeNull()
  expect(state.entries).toEqual([])
  expect(state.task?.upcomingSprintId).toBeUndefined()
  expect(state.current?.state).toBe("current")
})
