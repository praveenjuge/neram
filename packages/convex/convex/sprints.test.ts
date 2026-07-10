/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"

import { api, internal } from "./_generated/api"
import schema from "./schema"
import { initialSprintBounds } from "./sprintTime"

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

test("Organization projection enforces tenant isolation and stale-member denial", async () => {
  const { t, alice, bob, carol } = await setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Alpha Product",
  })
  await alice.mutation(api.tasks.create, { projectId, title: "Private task" })

  expect(await bob.query(api.projects.list, {})).toHaveLength(1)
  expect(await carol.query(api.projects.list, {})).toHaveLength(0)
  expect(await carol.query(api.projects.get, { projectId })).toBeNull()
  await expect(carol.query(api.tasks.list, { projectId })).rejects.toThrow()

  await t.mutation(internal.organizations.removeMemberProjection, {
    organizationId: "org_alpha",
    userId: "user_bob",
  })
  await expect(bob.query(api.projects.list, {})).rejects.toThrow()
})

test("members plan work and status movement applies Current and early-start rules", async () => {
  const { alice, bob } = await setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Product",
  })
  const backlogTask = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Start from backlog",
  })
  const upcomingTask = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Start early",
    sprint: "upcoming",
  })

  expect(
    (await bob.query(api.sprints.backlog, {})).map((task) => task._id)
  ).toContain(backlogTask)
  await bob.mutation(api.tasks.move, {
    taskId: backlogTask,
    status: "inProgress",
  })
  await bob.mutation(api.tasks.move, {
    taskId: upcomingTask,
    status: "inProgress",
  })

  const current = await bob.query(api.sprints.current, {})
  const upcoming = await bob.query(api.sprints.upcoming, {})
  expect(current?.tasks.map((task) => task._id).sort()).toEqual(
    [backlogTask, upcomingTask].sort()
  )
  expect(upcoming?.tasks).toHaveLength(0)

  await bob.mutation(api.sprints.remove, {
    taskIds: [upcomingTask],
    sprint: "current",
  })
  const removed = (await bob.query(api.sprints.backlog, {})).find(
    (task) => task._id === upcomingTask
  )
  expect(removed?.status).toBe("todo")
})

test("rollover credits cutoff completions, carries unfinished work, and preserves reopening history", async () => {
  const { alice } = await setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Product",
  })
  const completed = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Completed",
    sprint: "current",
  })
  const carried = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Carry me",
    sprint: "current",
  })
  const planned = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Planned next",
    sprint: "upcoming",
  })
  await alice.mutation(api.tasks.move, { taskId: completed, status: "done" })

  const jobId = await alice.mutation(api.sprints.rollover, {
    confirm: true,
    reason: "Customer deadline",
  })
  for (let index = 0; index < 10; index += 1) {
    const done = await alice.run(
      async (ctx) => (await ctx.db.get(jobId))?.status === "completed"
    )
    if (done) break
    await alice.mutation(internal.sprintRollover.process, { jobId })
  }

  const current = await alice.query(api.sprints.current, {})
  expect(current?.tasks.map((task) => task._id).sort()).toEqual(
    [carried, planned].sort()
  )
  const history = await alice.query(api.sprints.history, page)
  expect(history.page).toHaveLength(1)
  expect(history.page[0]).toMatchObject({
    completedCount: 1,
    carriedCount: 1,
    addedCount: 2,
    earlyCloseReason: "Customer deadline",
  })

  await alice.mutation(api.tasks.move, { taskId: completed, status: "todo" })
  const reopenedCurrent = await alice.query(api.sprints.current, {})
  expect(reopenedCurrent?.tasks.map((task) => task._id)).toContain(completed)
  const audit = await alice.query(api.sprints.audit, {
    sprintId: reopenedCurrent!.sprint._id,
    ...page,
  })
  expect(audit.page.find((entry) => entry.taskId === completed)?.origin).toBe(
    "reopened"
  )
})

test("Sprint boundaries retain local midnight across a DST change", () => {
  const bounds = initialSprintBounds(Date.parse("2026-03-03T12:00:00Z"), {
    cadenceWeeks: 2,
    startWeekday: 1,
    timezone: "America/New_York",
  })
  expect(new Date(bounds.startsAt).toISOString()).toBe(
    "2026-03-02T05:00:00.000Z"
  )
  expect(new Date(bounds.endsAt).toISOString()).toBe("2026-03-16T04:00:00.000Z")
})
