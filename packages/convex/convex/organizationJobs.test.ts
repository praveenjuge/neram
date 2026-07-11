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
  for (const member of [
    { userId: "user_admin", role: "org:admin" as const, displayName: "Ada" },
    { userId: "user_member", role: "org:member" as const, displayName: "Bob" },
  ]) {
    await t.mutation(internal.organizations.upsertMember, {
      organizationId: "org_acme",
      membershipId: `mem_${member.userId}`,
      ...member,
    })
  }
  const admin = t.withIdentity({
    subject: "user_admin",
    tokenIdentifier: "https://clerk.test|user_admin",
    name: "Ada",
    org_id: "org_acme",
    org_slug: "acme",
    org_role: "org:admin",
  })
  const member = t.withIdentity({
    subject: "user_member",
    tokenIdentifier: "https://clerk.test|user_member",
    name: "Bob",
    org_id: "org_acme",
    org_slug: "acme",
    org_role: "org:member",
  })
  const spoofedAdmin = t.withIdentity({
    subject: "user_member",
    tokenIdentifier: "https://clerk.test|user_member",
    name: "Bob",
    org_id: "org_acme",
    org_role: "org:admin",
  })
  return { t, admin, member, spoofedAdmin }
}

test("workspace deletion requires an admin and exact tenant confirmation", async () => {
  const { admin, member, spoofedAdmin } = await setup()
  await expect(
    member.mutation(api.organizations.beginDeletion, {
      organizationId: "org_acme",
      slug: "acme",
      confirm: true,
    })
  ).rejects.toThrow('"code":"FORBIDDEN"')
  await expect(
    spoofedAdmin.mutation(api.organizations.beginDeletion, {
      organizationId: "org_acme",
      slug: "acme",
      confirm: true,
    })
  ).rejects.toThrow('"code":"FORBIDDEN"')
  await expect(
    admin.mutation(api.organizations.beginDeletion, {
      organizationId: "org_acme",
      slug: "other",
      confirm: true,
    })
  ).rejects.toThrow('"code":"CONFIRMATION_REQUIRED"')
})

test("member removal unassigns open work and preserves completed attribution", async () => {
  const { t, admin } = await setup()
  const projectId = await admin.mutation(api.projects.create, {
    name: "Product",
  })
  const openTask = await admin.mutation(api.tasks.create, {
    projectId,
    title: "Open",
    assigneeSubject: "user_member",
  })
  const completedTask = await admin.mutation(api.tasks.create, {
    projectId,
    title: "Completed",
    assigneeSubject: "user_member",
  })
  await admin.mutation(api.tasks.move, {
    taskId: completedTask,
    status: "done",
  })

  await t.mutation(internal.organizations.removeMemberProjection, {
    organizationId: "org_acme",
    userId: "user_member",
  })
  const job = await t.query(internal.organizationJobs.running, {
    organizationId: "org_acme",
    kind: "member_cleanup",
  })
  expect(job).not.toBeNull()
  await t.mutation(internal.organizationJobs.cleanupMember, { jobId: job!._id })

  const tasks = await admin.query(api.tasks.list, { projectId })
  expect(tasks.find((task) => task._id === openTask)).not.toHaveProperty(
    "assigneeSubject"
  )
  expect(tasks.find((task) => task._id === completedTask)).toMatchObject({
    assigneeSubject: "user_member",
    assigneeName: "Bob",
  })
})

test("coordinated external deletion drains task children before the Organization", async () => {
  const { t, admin } = await setup()
  const projectId = await admin.mutation(api.projects.create, {
    name: "Product",
  })
  const taskId = await admin.mutation(api.tasks.create, {
    projectId,
    title: "Delete safely",
  })
  await admin.mutation(api.subtasks.create, { taskId, title: "Child" })
  await admin.mutation(api.taskComments.create, {
    taskId,
    body: "Comment",
    mentions: [],
  })

  await t.mutation(internal.organizations.handleExternalDeletion, {
    organizationId: "org_acme",
  })
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const job = await t.query(internal.organizationJobs.running, {
      organizationId: "org_acme",
      kind: "workspace_deletion",
    })
    if (!job) break
    if (job.phase === "clerk") {
      await t.mutation(internal.organizationJobs.finishWorkspaceDeletion, {
        jobId: job._id,
        organizationId: "org_acme",
      })
      break
    }
    await t.mutation(internal.organizationJobs.purgeWorkspace, {
      jobId: job._id,
    })
  }

  const remaining = await t.run(async (ctx) => ({
    organizations: await ctx.db.query("organizations").take(10),
    projects: await ctx.db.query("projects").take(10),
    tasks: await ctx.db.query("tasks").take(10),
    subtasks: await ctx.db.query("subtasks").take(10),
    comments: await ctx.db.query("taskComments").take(10),
    stats: await ctx.db.query("taskStats").take(10),
  }))
  expect(remaining).toEqual({
    organizations: [],
    projects: [],
    tasks: [],
    subtasks: [],
    comments: [],
    stats: [],
  })
})
