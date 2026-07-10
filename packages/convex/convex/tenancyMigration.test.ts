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

import { api, components, internal } from "./_generated/api"
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
  const owner = t.withIdentity({
    subject: "user_owner",
    tokenIdentifier: "https://clerk.test|user_owner",
    name: "Owner",
  })
  const member = t.withIdentity({
    subject: "user_member",
    tokenIdentifier: "https://clerk.test|user_member",
    name: "Member",
  })
  const projectId = await owner.mutation(api.projects.create, {
    name: "Legacy Product",
  })
  const invite = await owner.mutation(api.invites.ensure, { projectId })
  await member.mutation(api.invites.accept, { token: invite })
  const taskId = await owner.mutation(api.tasks.create, {
    projectId,
    title: "Legacy task",
  })
  await owner.mutation(api.subtasks.create, { taskId, title: "Child" })
  await owner.mutation(api.taskComments.create, {
    taskId,
    body: "History",
    mentions: [],
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
      internal.migrations.backfillActivity,
      internal.migrations.backfillWorkStates,
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
  })

  await t.run(async (ctx) => {
    for (const migration of [
      internal.migrations.purgeProjectMembers,
      internal.migrations.purgeLegacyActivity,
      internal.migrations.purgeWorkStates,
    ]) {
      await runToCompletion(ctx, components.migrations, migration)
    }
  })
  const legacy = await t.run(async (ctx) => ({
    members: await ctx.db.query("projectMembers").take(10),
    invites: await ctx.db.query("projectInvites").take(10),
    activity: await ctx.db.query("activity").take(10),
    workStates: await ctx.db.query("projectWorkStates").take(10),
  }))
  expect(legacy).toEqual({
    members: [],
    invites: [],
    activity: [],
    workStates: [],
  })
})
