/// <reference types="vite/client" />
import migrationsComponent from "@convex-dev/migrations/test"
import { runToCompletion } from "@convex-dev/migrations"
import { convexTest } from "convex-test"
import { beforeEach, expect, test, vi } from "vitest"

const clerkState = vi.hoisted(() => ({
  organizations: [] as Array<{
    id: string
    name: string
    slug: string
    privateMetadata: Record<string, unknown>
  }>,
  memberships: new Map<
    string,
    Array<{
      id: string
      role: "org:admin" | "org:member"
      organization: { id: string }
      publicUserData: {
        userId: string
        firstName: string
        lastName: null
        identifier: string
        imageUrl: undefined
      }
    }>
  >(),
  createCount: 0,
  failMembershipOnce: false,
}))

vi.mock("@clerk/backend", () => ({
  createClerkClient: () => ({
    instance: {
      getOrganizationSettings: async () => ({
        enabled: true,
        maxAllowedMemberships: 0,
      }),
    },
    users: {
      getUser: async (userId: string) => ({
        id: userId,
        firstName: userId === "user_owner" ? "Owner" : "Member",
        lastName: null,
        username: null,
        primaryEmailAddress: {
          emailAddress: `${userId}@example.com`,
        },
      }),
    },
    organizations: {
      getOrganizationList: async () => ({ data: clerkState.organizations }),
      getOrganization: async ({ organizationId }: { organizationId: string }) =>
        clerkState.organizations.find((row) => row.id === organizationId),
      createOrganization: async (args: {
        name: string
        slug: string
        createdBy: string
        privateMetadata: Record<string, unknown>
      }) => {
        clerkState.createCount += 1
        const organization = {
          id: `org_${clerkState.createCount}`,
          name: args.name,
          slug: args.slug,
          privateMetadata: args.privateMetadata,
        }
        clerkState.organizations.push(organization)
        clerkState.memberships.set(organization.id, [
          membership(organization.id, args.createdBy, "org:admin"),
        ])
        return organization
      },
      getOrganizationMembershipList: async ({
        organizationId,
      }: {
        organizationId: string
      }) => ({ data: clerkState.memberships.get(organizationId) ?? [] }),
      createOrganizationMembership: async (args: {
        organizationId: string
        userId: string
        role: "org:admin" | "org:member"
      }) => {
        if (clerkState.failMembershipOnce) {
          clerkState.failMembershipOnce = false
          throw new Error("Injected Clerk membership failure")
        }
        const rows = clerkState.memberships.get(args.organizationId) ?? []
        rows.push(membership(args.organizationId, args.userId, args.role))
        clerkState.memberships.set(args.organizationId, rows)
      },
    },
  }),
}))

import { components, internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
process.env.CLERK_SECRET_KEY = "sk_test_migration"

function membership(
  organizationId: string,
  userId: string,
  role: "org:admin" | "org:member"
) {
  return {
    id: `mem_${organizationId}_${userId}`,
    role,
    organization: { id: organizationId },
    publicUserData: {
      userId,
      firstName: userId === "user_owner" ? "Owner" : "Member",
      lastName: null,
      identifier: `${userId}@example.com`,
      imageUrl: undefined,
    },
  }
}

beforeEach(() => {
  clerkState.organizations.length = 0
  clerkState.memberships.clear()
  clerkState.createCount = 0
  clerkState.failMembershipOnce = false
})

async function legacyFixture() {
  const t = convexTest(schema, modules)
  migrationsComponent.register(t)
  await t.run(async (ctx) => {
    const now = Date.now()
    const projectId = await ctx.db.insert("projects", {
      ownerSubject: "https://clerk.test|user_owner",
      ownerName: "Owner",
      name: "Legacy Product",
      createdAt: now,
      updatedAt: now,
      taskCount: 1,
      todoCount: 1,
      inProgressCount: 0,
      doneCount: 0,
    })
    await ctx.db.insert("projectMembers", {
      projectId,
      subject: "https://clerk.test|user_member",
      displayName: "Member",
      role: "editor",
      createdAt: now,
    })
    await ctx.db.insert("projectInvites", {
      projectId,
      token: "legacy-invite-token",
      createdBy: "https://clerk.test|user_owner",
      createdAt: now,
    })
    const taskId = await ctx.db.insert("tasks", {
      ownerSubject: "https://clerk.test|user_owner",
      projectId,
      title: "Legacy task",
      status: "todo",
      assigneeSubject: "https://clerk.test|user_member",
      assigneeName: "Member",
      position: now,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("subtasks", {
      taskId,
      title: "Child",
      completed: false,
      position: now,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("taskComments", {
      taskId,
      authorSubject: "https://clerk.test|user_member",
      authorName: "Member",
      body: "History",
      mentions: [
        {
          start: 0,
          length: 6,
          subject: "https://clerk.test|user_owner",
          label: "Owner",
        },
      ],
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("taskStats", {
      taskId,
      projectId,
      totalSubtasks: 1,
      completedSubtasks: 0,
      activeCommentCount: 1,
    })
    await ctx.db.insert("activity", {
      subject: "https://clerk.test|user_owner",
      actorSubject: "https://clerk.test|user_owner",
      actorName: "Owner",
      projectId,
      projectName: "Legacy Product",
      type: "task.created",
      taskTitle: "Legacy task",
      taskId,
      createdAt: now,
    })
  })
  return { t }
}

test("dry inventory is deterministic and never persists state", async () => {
  const { t } = await legacyFixture()
  const first = await t.action(internal.tenancyMigration.inventory, {
    persist: false,
  })
  const second = await t.action(internal.tenancyMigration.inventory, {
    persist: false,
  })
  expect(first.cohorts).toEqual(second.cohorts)
  expect(first).toMatchObject({
    projects: 1,
    tasks: 1,
    subtasks: 1,
    comments: 1,
    legacyMembers: 1,
    legacyInvites: 1,
    persisted: false,
  })
  expect(
    await t.run(async (ctx) => ctx.db.query("tenancyMigrationRuns").take(10))
  ).toEqual([])
})

test("provision resumes after Clerk failure, verifies rows, and narrows cleanly", async () => {
  const { t } = await legacyFixture()
  await t.run(async (ctx) => {
    const now = Date.now()
    const deletedProjectId = await ctx.db.insert("projects", {
      ownerSubject: "https://clerk.test|user_owner",
      ownerName: "Owner",
      name: "Deleted legacy project",
      createdAt: now,
      updatedAt: now,
      taskCount: 0,
      todoCount: 0,
      inProgressCount: 0,
      doneCount: 0,
    })
    await ctx.db.delete(deletedProjectId)
    await ctx.db.insert("activity", {
      subject: "https://clerk.test|user_owner",
      actorSubject: "https://retired-clerk.test|user_old_owner",
      actorName: "Owner",
      projectId: deletedProjectId,
      projectName: "Deleted legacy project",
      type: "task.deleted",
      createdAt: now,
    })
  })
  clerkState.failMembershipOnce = true
  await expect(
    t.action(internal.tenancyMigration.provision, {})
  ).rejects.toThrow("Injected Clerk membership failure")
  expect(clerkState.createCount).toBe(1)

  const provisioned = await t.action(internal.tenancyMigration.provision, {})
  expect(provisioned.organizations).toHaveLength(1)
  expect(clerkState.createCount).toBe(1)

  await t.run(async (ctx) => {
    for (const migration of [
      internal.migrations.backfillProjects,
      internal.migrations.backfillTasks,
      internal.migrations.normalizeTaskAssignees,
      internal.migrations.backfillActivity,
      internal.migrations.backfillWorkStates,
      internal.migrations.normalizeTaskComments,
      internal.migrations.revokeProjectInvites,
    ]) {
      await runToCompletion(ctx, components.migrations, migration)
    }
  })

  const verification = await t.action(internal.tenancyMigration.verify, {})
  expect(verification).toMatchObject({ ok: true, failures: [] })
  expect(verification.counts).toMatchObject({
    projects: 1,
    tasks: 1,
    subtasks: 1,
    comments: 1,
    remainingInvites: 0,
    orphanProjectMappings: 1,
  })

  await t.run(async (ctx) => {
    for (const migration of [
      internal.migrations.purgeProjectMembers,
      internal.migrations.purgeLegacyActivity,
      internal.migrations.purgeWorkStates,
      internal.migrations.clearProjectOwners,
      internal.migrations.clearTaskOwners,
      internal.migrations.purgeTenancyCohortMembers,
      internal.migrations.purgeTenancyProjectMappings,
      internal.migrations.purgeTenancyCohorts,
      internal.migrations.purgeTenancyRuns,
    ]) {
      await runToCompletion(ctx, components.migrations, migration)
    }
  })
  const legacy = await t.run(async (ctx) => ({
    members: await ctx.db.query("projectMembers").take(10),
    invites: await ctx.db.query("projectInvites").take(10),
    activity: await ctx.db.query("activity").take(10),
    workStates: await ctx.db.query("projectWorkStates").take(10),
    projects: await ctx.db.query("projects").take(10),
    tasks: await ctx.db.query("tasks").take(10),
    migrationRuns: await ctx.db.query("tenancyMigrationRuns").take(10),
  }))
  expect(legacy).toEqual({
    members: [],
    invites: [],
    activity: [],
    workStates: [],
    projects: [
      expect.not.objectContaining({ ownerSubject: expect.anything() }),
    ],
    tasks: [expect.not.objectContaining({ ownerSubject: expect.anything() })],
    migrationRuns: [],
  })
})
