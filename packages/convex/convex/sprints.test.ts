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
  await bob.mutation(api.sprints.plan, {
    taskIds: [upcomingTask],
    sprint: "upcoming",
  })
  await bob.mutation(api.sprints.plan, {
    taskIds: [upcomingTask],
    sprint: "upcoming",
  })
  const upcomingBeforeStart = await bob.query(api.sprints.upcoming, {})
  const plannedEntries = await bob.query(api.sprints.audit, {
    sprintId: upcomingBeforeStart!.sprint._id,
    ...page,
  })
  expect(
    plannedEntries.page.filter((entry) => entry.taskId === upcomingTask)
  ).toHaveLength(1)

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
  expect(await bob.query(api.projects.get, { projectId })).toMatchObject({
    todoCount: 1,
    inProgressCount: 1,
  })
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

  await expect(
    alice.mutation(api.sprints.rollover, {
      organizationId: "org_alpha",
      slug: "wrong",
      confirm: true,
      reason: "Should fail",
    })
  ).rejects.toThrow()

  const jobId = await alice.mutation(api.sprints.rollover, {
    organizationId: "org_alpha",
    slug: "alpha",
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

test("closed summaries preserve baseline truth and later scope changes", async () => {
  const { alice } = await setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Planning",
  })
  const carried = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Carry forward",
    sprint: "current",
  })
  const planned = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Opening plan",
    sprint: "upcoming",
  })
  const firstJob = await alice.mutation(api.sprints.rollover, {
    organizationId: "org_alpha",
    slug: "alpha",
    confirm: true,
    reason: "Open the planned Sprint",
  })
  for (let index = 0; index < 10; index += 1) {
    const done = await alice.run(
      async (ctx) => (await ctx.db.get(firstJob))?.status === "completed"
    )
    if (done) break
    await alice.mutation(internal.sprintRollover.process, { jobId: firstJob })
  }

  await alice.mutation(api.sprints.remove, {
    taskIds: [planned],
    sprint: "current",
  })
  const added = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Late discovery",
  })
  await alice.mutation(api.tasks.move, { taskId: added, status: "inProgress" })
  await alice.mutation(api.tasks.move, { taskId: carried, status: "done" })

  const secondJob = await alice.mutation(api.sprints.rollover, {
    organizationId: "org_alpha",
    slug: "alpha",
    confirm: true,
    reason: "Close with scope truth",
  })
  for (let index = 0; index < 10; index += 1) {
    const done = await alice.run(
      async (ctx) => (await ctx.db.get(secondJob))?.status === "completed"
    )
    if (done) break
    await alice.mutation(internal.sprintRollover.process, { jobId: secondJob })
  }

  const history = await alice.query(api.sprints.history, page)
  expect(history.page[0]).toMatchObject({
    number: 2,
    baselineCount: 2,
    completedCount: 1,
    carriedCount: 1,
    addedCount: 1,
    removedCount: 1,
  })
})

test("delayed rollover uses the scheduled cutoff and repair resumes one job", async () => {
  const { t, alice } = await setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Cutoff",
  })
  const exact = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Exact cutoff",
    sprint: "current",
  })
  const late = await alice.mutation(api.tasks.create, {
    projectId,
    title: "After cutoff",
    sprint: "current",
  })
  const current = await alice.query(api.sprints.current, {})
  const cutoffAt = Date.now() - 1_000
  await t.run(async (ctx) => {
    await ctx.db.patch(current!.sprint._id, { endsAt: cutoffAt })
    for (const [taskId, completedAt] of [
      [exact, cutoffAt],
      [late, cutoffAt + 1],
    ] as const) {
      await ctx.db.patch(taskId, { status: "done", completedAt })
      const entry = await ctx.db
        .query("sprintTaskEntries")
        .withIndex("by_sprint_task_and_removed", (q) =>
          q
            .eq("sprintId", current!.sprint._id)
            .eq("taskId", taskId)
            .eq("removedAt", undefined)
        )
        .unique()
      await ctx.db.patch(entry!._id, { creditedCompletionAt: completedAt })
    }
  })

  await alice.mutation(internal.sprintRollover.scheduled, {
    organizationId: "org_alpha",
    sprintId: current!.sprint._id,
  })
  const jobId = await t.run(async (ctx) => {
    const jobs = await ctx.db
      .query("sprintRolloverJobs")
      .withIndex("by_closing_sprint", (q) =>
        q.eq("closingSprintId", current!.sprint._id)
      )
      .take(10)
    expect(jobs).toHaveLength(1)
    return jobs[0]._id
  })
  await alice.mutation(internal.sprintRollover.process, { jobId })
  await alice.mutation(internal.sprintRollover.repair, {})
  for (let index = 0; index < 10; index += 1) {
    const done = await alice.run(
      async (ctx) => (await ctx.db.get(jobId))?.status === "completed"
    )
    if (done) break
    await alice.mutation(internal.sprintRollover.process, { jobId })
  }

  const history = await alice.query(api.sprints.history, page)
  expect(history.page[0]).toMatchObject({
    closedCutoffAt: cutoffAt,
    completedCount: 1,
    carriedCount: 1,
  })
  expect((await alice.query(api.sprints.current, {}))?.tasks).toEqual(
    expect.arrayContaining([expect.objectContaining({ _id: late })])
  )
  expect(
    await t.run(
      async (ctx) =>
        await ctx.db
          .query("sprintRolloverJobs")
          .withIndex("by_closing_sprint", (q) =>
            q.eq("closingSprintId", current!.sprint._id)
          )
          .take(10)
    )
  ).toHaveLength(1)
})

test("Sprint entry history cannot grow beyond the 1,000-task ceiling", async () => {
  const { t, alice } = await setup()
  const projectId = await alice.mutation(api.projects.create, {
    name: "Ceiling",
  })
  const filler = await alice.mutation(api.tasks.create, {
    projectId,
    title: "Historical filler",
  })
  const target = await alice.mutation(api.tasks.create, {
    projectId,
    title: "One too many",
  })
  const current = await alice.query(api.sprints.current, {})
  for (let batch = 0; batch < 10; batch += 1) {
    await t.run(async (ctx) => {
      for (let offset = 0; offset < 100; offset += 1) {
        const index = batch * 100 + offset
        await ctx.db.insert("sprintTaskEntries", {
          organizationId: "org_alpha",
          sprintId: current!.sprint._id,
          taskId: filler,
          projectId,
          projectNameSnapshot: "Ceiling",
          taskTitleSnapshot: "Historical filler",
          origin: "scope_added",
          actorUserId: "user_alice",
          actorName: "Alice",
          addedAt: index,
          removedAt: index + 1,
          removedByUserId: "user_alice",
          removedByName: "Alice",
          removalReason: "test_churn",
        })
      }
    })
  }
  await expect(
    alice.mutation(api.sprints.plan, {
      taskIds: [target],
      sprint: "current",
    })
  ).rejects.toThrow("at most 1,000 tasks")
})

test("Sprint API keeps stable validation errors and allows member planning controls", async () => {
  const { alice, bob, carol } = await setup()
  const beforeCurrent = await alice.query(api.sprints.current, {})
  const beforeUpcoming = await alice.query(api.sprints.upcoming, {})

  await bob.mutation(api.sprints.updateGoal, {
    sprint: "current",
    goal: "Ship the tenant cutover",
  })
  await bob.mutation(api.sprints.updateCadence, {
    cadenceWeeks: 3,
    startWeekday: 2,
    timezone: "Asia/Kolkata",
  })
  const afterCurrent = await alice.query(api.sprints.current, {})
  const afterUpcoming = await alice.query(api.sprints.upcoming, {})
  expect(afterCurrent?.sprint).toMatchObject({
    goal: "Ship the tenant cutover",
    endsAt: beforeCurrent?.sprint.endsAt,
  })
  expect(afterUpcoming?.sprint.endsAt).not.toBe(beforeUpcoming?.sprint.endsAt)

  await expect(
    bob.mutation(api.sprints.updateCadence, {
      cadenceWeeks: 0,
      startWeekday: 1,
      timezone: "UTC",
    })
  ).rejects.toThrow('"code":"INVALID_CADENCE"')
  await expect(
    bob.mutation(api.sprints.updateGoal, {
      sprint: "current",
      goal: "x".repeat(501),
    })
  ).rejects.toThrow('"code":"INVALID_GOAL"')
  await expect(
    carol.query(api.sprints.audit, {
      sprintId: beforeCurrent!.sprint._id,
      ...page,
    })
  ).rejects.toThrow('"code":"NOT_FOUND"')

  await expect(
    bob.mutation(api.sprints.rollover, {
      organizationId: "org_alpha",
      slug: "alpha",
      confirm: true,
      reason: "Member-triggered close",
    })
  ).resolves.toBeDefined()
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
