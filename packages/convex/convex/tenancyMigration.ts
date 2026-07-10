"use node"

import { createClerkClient } from "@clerk/backend"
import type { Organization } from "@clerk/backend"
import { createHash } from "node:crypto"
import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { env, internalAction } from "./_generated/server"
import type { ActionCtx } from "./_generated/server"

const RUN_KEY = "clerk-organizations-v1"

type Page<T> = { page: T[]; isDone: boolean; continueCursor: string }

function clerk() {
  if (!env.CLERK_SECRET_KEY) {
    throw new ConvexError({
      code: "CLERK_NOT_CONFIGURED",
      message: "Clerk is not configured.",
    })
  }
  return createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
}

async function allProjects(ctx: ActionCtx) {
  const rows: Array<Doc<"projects">> = []
  let cursor: string | null = null
  do {
    const page: Page<Doc<"projects">> = await ctx.runQuery(
      internal.tenancyMigrationData.projectPage,
      {
        paginationOpts: { numItems: 100, cursor },
      }
    )
    rows.push(...page.page)
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return rows
}

async function allTasks(ctx: ActionCtx) {
  const rows: Array<Doc<"tasks">> = []
  let cursor: string | null = null
  do {
    const page: Page<Doc<"tasks">> = await ctx.runQuery(
      internal.tenancyMigrationData.taskPage,
      {
        paginationOpts: { numItems: 100, cursor },
      }
    )
    rows.push(...page.page)
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return rows
}

async function allActivity(ctx: ActionCtx) {
  const rows: Array<Doc<"activity">> = []
  let cursor: string | null = null
  do {
    const page: Page<Doc<"activity">> = await ctx.runQuery(
      internal.tenancyMigrationData.activityPage,
      {
        paginationOpts: { numItems: 100, cursor },
      }
    )
    rows.push(...page.page)
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return rows
}

async function allMembers(ctx: ActionCtx) {
  const rows: Array<Doc<"projectMembers">> = []
  let cursor: string | null = null
  do {
    const page: Page<Doc<"projectMembers">> = await ctx.runQuery(
      internal.tenancyMigrationData.memberPage,
      {
        paginationOpts: { numItems: 100, cursor },
      }
    )
    rows.push(...page.page)
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return rows
}

async function countInvites(ctx: ActionCtx) {
  let count = 0
  let cursor: string | null = null
  do {
    const page: Page<Doc<"projectInvites">> = await ctx.runQuery(
      internal.tenancyMigrationData.invitePage,
      {
        paginationOpts: { numItems: 100, cursor },
      }
    )
    count += page.page.length
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return count
}

async function countWorkStates(ctx: ActionCtx) {
  let count = 0
  let cursor: string | null = null
  do {
    const page: Page<Doc<"projectWorkStates">> = await ctx.runQuery(
      internal.tenancyMigrationData.workStatePage,
      {
        paginationOpts: { numItems: 100, cursor },
      }
    )
    count += page.page.length
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor)
  return count
}

function userIdFromSubject(subject: string) {
  const userId = subject.split("|").at(-1)
  return userId?.startsWith("user_") ? userId : undefined
}

function stableKey(signature: string) {
  return `cohort_${createHash("sha256").update(signature).digest("hex").slice(0, 24)}`
}

function slugPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "-")
    .slice(0, 42)
}

function ownerLabel(displayName: string) {
  const localPart = displayName.includes("@")
    ? displayName.split("@")[0]
    : displayName
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

async function buildInventory(ctx: ActionCtx) {
  const [
    projects,
    tasks,
    activity,
    projectMembers,
    inviteCount,
    workStateCount,
  ] = await Promise.all([
    allProjects(ctx),
    allTasks(ctx),
    allActivity(ctx),
    allMembers(ctx),
    countInvites(ctx),
    countWorkStates(ctx),
  ])
  const membersByProject = new Map<string, Array<Doc<"projectMembers">>>()
  for (const member of projectMembers) {
    const list = membersByProject.get(member.projectId) ?? []
    list.push(member)
    membersByProject.set(member.projectId, list)
  }
  const grouped = new Map<
    string,
    {
      ownerSubject: string
      projects: Array<Doc<"projects">>
      subjects: string[]
    }
  >()
  for (const project of projects) {
    const collaborators = (membersByProject.get(project._id) ?? [])
      .map((member) => member.subject)
      .sort()
    const signature = [project.ownerSubject, ...collaborators].join("\n")
    const group = grouped.get(signature) ?? {
      ownerSubject: project.ownerSubject,
      projects: [],
      subjects: collaborators,
    }
    group.projects.push(project)
    grouped.set(signature, group)
  }

  const allSubjects = new Set<string>()
  for (const group of grouped.values()) {
    allSubjects.add(group.ownerSubject)
    for (const subject of group.subjects) allSubjects.add(subject)
  }
  const userBySubject = new Map<
    string,
    { userId: string; displayName: string }
  >()
  const unmapped: string[] = []
  for (const subject of [...allSubjects].sort()) {
    const userId = userIdFromSubject(subject)
    if (!userId) {
      unmapped.push(subject)
      continue
    }
    try {
      const user = await clerk().users.getUser(userId)
      userBySubject.set(subject, {
        userId,
        displayName:
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.primaryEmailAddress?.emailAddress ||
          user.username ||
          "Member",
      })
    } catch {
      unmapped.push(subject)
    }
  }
  if (unmapped.length > 0) {
    throw new ConvexError({
      code: "UNMAPPED_CLERK_USERS",
      message: `${unmapped.length} legacy subject(s) do not map to Clerk users.`,
      subjects: unmapped,
    })
  }

  const raw = [...grouped.entries()]
    .map(([signature, group]) => ({ signature, ...group }))
    .sort(
      (a, b) =>
        a.ownerSubject.localeCompare(b.ownerSubject) ||
        a.signature.localeCompare(b.signature)
    )
  const ownerOrdinals = new Map<string, number>()
  const ownerTotals = new Map<string, number>()
  for (const group of raw)
    ownerTotals.set(
      group.ownerSubject,
      (ownerTotals.get(group.ownerSubject) ?? 0) + 1
    )
  const cohorts = raw.map((group) => {
    const ordinalForOwner = (ownerOrdinals.get(group.ownerSubject) ?? 0) + 1
    ownerOrdinals.set(group.ownerSubject, ordinalForOwner)
    const owner = userBySubject.get(group.ownerSubject)!
    const cohortKey = stableKey(group.signature)
    const suffix =
      (ownerTotals.get(group.ownerSubject) ?? 1) > 1
        ? ` ${ordinalForOwner}`
        : ""
    const label = ownerLabel(owner.displayName) || "Neram"
    const organizationName = `${label}'s Workspace${suffix}`
    const organizationSlug = `${slugPart(label) || "neram"}-workspace-${cohortKey.slice(-6)}`
    return {
      cohortKey,
      ownerSubject: group.ownerSubject,
      ownerUserId: owner.userId,
      ownerDisplayName: owner.displayName,
      ordinalForOwner,
      organizationName,
      organizationSlug,
      projects: group.projects.map((project) => project._id),
      members: [
        {
          subject: group.ownerSubject,
          userId: owner.userId,
          role: "org:admin" as const,
          displayName: owner.displayName,
        },
        ...group.subjects.map((subject) => ({
          subject,
          userId: userBySubject.get(subject)!.userId,
          role: "org:member" as const,
          displayName: userBySubject.get(subject)!.displayName,
        })),
      ],
    }
  })
  const settings = await clerk().instance.getOrganizationSettings()
  const largestCohort = Math.max(
    0,
    ...cohorts.map((cohort) => cohort.members.length)
  )
  if (
    !settings.enabled ||
    (settings.maxAllowedMemberships !== 0 &&
      settings.maxAllowedMemberships < largestCohort)
  ) {
    throw new ConvexError({
      code: "CLERK_ORGANIZATION_QUOTA",
      message:
        "Clerk Organizations are disabled or the membership limit is too low for this migration.",
    })
  }
  return {
    projects,
    tasks,
    activity,
    projectMembers,
    inviteCount,
    workStateCount,
    maxAllowedMemberships: settings.maxAllowedMemberships,
    cohorts,
  }
}

function persistedCohort(
  cohort: Awaited<ReturnType<typeof buildInventory>>["cohorts"][number]
) {
  return {
    cohortKey: cohort.cohortKey,
    ownerSubject: cohort.ownerSubject,
    ownerUserId: cohort.ownerUserId,
    ownerDisplayName: cohort.ownerDisplayName,
    ordinalForOwner: cohort.ordinalForOwner,
    projects: cohort.projects,
    members: cohort.members,
  }
}

export const inventory = internalAction({
  args: { persist: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const report = await buildInventory(ctx)
    if (args.persist) {
      await ctx.runMutation(internal.tenancyMigrationData.persistInventory, {
        key: RUN_KEY,
        expectedProjects: report.projects.length,
        expectedTasks: report.tasks.length,
        expectedActivityRows: report.activity.length,
        expectedLegacyMembers: report.projectMembers.length,
        expectedLegacyInvites: report.inviteCount,
        cohorts: report.cohorts.map(persistedCohort),
      })
    }
    return {
      runKey: RUN_KEY,
      projects: report.projects.length,
      tasks: report.tasks.length,
      activityRows: report.activity.length,
      legacyMembers: report.projectMembers.length,
      legacyInvites: report.inviteCount,
      legacyWorkStates: report.workStateCount,
      cohorts: report.cohorts.map((cohort) => ({
        cohortKey: cohort.cohortKey,
        ownerUserId: cohort.ownerUserId,
        organizationName: cohort.organizationName,
        organizationSlug: cohort.organizationSlug,
        projectCount: cohort.projects.length,
        memberCount: cohort.members.length,
      })),
      maxAllowedMemberships: report.maxAllowedMemberships,
      persisted: args.persist ?? false,
    }
  },
})

function membershipView(
  membership: Awaited<
    ReturnType<
      ReturnType<typeof clerk>["organizations"]["getOrganizationMembershipList"]
    >
  >["data"][number]
) {
  const user = membership.publicUserData
  return {
    organizationId: membership.organization.id,
    membershipId: membership.id,
    userId: user?.userId ?? "",
    role:
      membership.role === "org:admin"
        ? ("org:admin" as const)
        : ("org:member" as const),
    displayName:
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      user?.identifier ||
      "Member",
    email: user?.identifier ?? undefined,
    imageUrl: user?.imageUrl ?? undefined,
  }
}

export const provision = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    runKey: string
    organizations: Array<{
      cohortKey: string
      organizationId: string
      slug: string
    }>
  }> => {
    const report = await buildInventory(ctx)
    await ctx.runMutation(internal.tenancyMigrationData.persistInventory, {
      key: RUN_KEY,
      expectedProjects: report.projects.length,
      expectedTasks: report.tasks.length,
      expectedActivityRows: report.activity.length,
      expectedLegacyMembers: report.projectMembers.length,
      expectedLegacyInvites: report.inviteCount,
      cohorts: report.cohorts.map(persistedCohort),
    })
    const existingOrganizations =
      await clerk().organizations.getOrganizationList({ limit: 500 })
    const results = []
    for (const cohort of report.cohorts) {
      const saved: Doc<"tenancyMigrationCohorts"> | null = await ctx.runQuery(
        internal.tenancyMigrationData.cohortState,
        { cohortKey: cohort.cohortKey }
      )
      let organization: Organization | undefined = saved?.organizationId
        ? await clerk().organizations.getOrganization({
            organizationId: saved.organizationId,
          })
        : existingOrganizations.data.find(
            (candidate) =>
              candidate.privateMetadata.neramCohortKey === cohort.cohortKey
          )
      if (!organization) {
        organization = await clerk().organizations.createOrganization({
          name: cohort.organizationName,
          slug: cohort.organizationSlug,
          createdBy: cohort.ownerUserId,
          privateMetadata: { neramCohortKey: cohort.cohortKey },
        })
      }
      const memberships =
        await clerk().organizations.getOrganizationMembershipList({
          organizationId: organization.id,
          limit: 500,
        })
      const existingUsers = new Set(
        memberships.data.map((membership) => membership.publicUserData?.userId)
      )
      for (const member of cohort.members) {
        if (!existingUsers.has(member.userId)) {
          await clerk().organizations.createOrganizationMembership({
            organizationId: organization.id,
            userId: member.userId,
            role: member.role,
          })
        }
      }
      const refreshed =
        await clerk().organizations.getOrganizationMembershipList({
          organizationId: organization.id,
          limit: 500,
        })
      await ctx.runMutation(internal.organizations.upsertOrganization, {
        organizationId: organization.id,
        slug: organization.slug,
        name: organization.name,
      })
      for (const membership of refreshed.data) {
        const view = membershipView(membership)
        if (view.userId)
          await ctx.runMutation(internal.organizations.upsertMember, view)
      }
      await ctx.runMutation(internal.tenancyMigrationData.recordProvisioned, {
        runKey: RUN_KEY,
        cohortKey: cohort.cohortKey,
        organizationId: organization.id,
        organizationSlug: organization.slug,
        organizationName: organization.name,
      })
      results.push({
        cohortKey: cohort.cohortKey,
        organizationId: organization.id,
        slug: organization.slug,
      })
    }
    await ctx.runMutation(internal.tenancyMigrationData.markRunPhase, {
      key: RUN_KEY,
      phase: "provisioned",
    })
    return { runKey: RUN_KEY, organizations: results }
  },
})

export const verify = internalAction({
  args: {},
  handler: async (ctx) => {
    const report = await buildInventory(ctx)
    const failures: string[] = []
    const projectById = new Map(
      report.projects.map((project) => [project._id, project])
    )
    for (const project of report.projects) {
      if (!project.organizationId)
        failures.push(`project:${project._id}:missing_organization`)
    }
    for (const task of report.tasks) {
      const project = projectById.get(task.projectId)
      if (
        !task.organizationId ||
        task.organizationId !== project?.organizationId
      ) {
        failures.push(`task:${task._id}:tenant_mismatch`)
      }
    }
    for (const activity of report.activity) {
      const project = projectById.get(activity.projectId)
      if (
        !activity.organizationId ||
        activity.organizationId !== project?.organizationId
      ) {
        failures.push(`activity:${activity._id}:tenant_mismatch`)
      }
    }
    const remainingInvites = await countInvites(ctx)
    if (remainingInvites !== 0)
      failures.push(`projectInvites:${remainingInvites}:not_revoked`)
    for (const cohort of report.cohorts) {
      const saved = await ctx.runQuery(
        internal.tenancyMigrationData.cohortState,
        { cohortKey: cohort.cohortKey }
      )
      if (!saved?.organizationId) {
        failures.push(`cohort:${cohort.cohortKey}:not_provisioned`)
        continue
      }
      const memberships =
        await clerk().organizations.getOrganizationMembershipList({
          organizationId: saved.organizationId,
          limit: 500,
        })
      const actual = new Map(
        memberships.data.map((membership) => [
          membership.publicUserData?.userId,
          membership.role,
        ])
      )
      for (const member of cohort.members) {
        if (actual.get(member.userId) !== member.role) {
          failures.push(
            `cohort:${cohort.cohortKey}:membership:${member.userId}`
          )
        }
      }
    }
    if (failures.length === 0) {
      await ctx.runMutation(internal.tenancyMigrationData.markRunPhase, {
        key: RUN_KEY,
        phase: "verified",
      })
    }
    return {
      ok: failures.length === 0,
      failures,
      counts: {
        projects: report.projects.length,
        tasks: report.tasks.length,
        activityRows: report.activity.length,
        cohorts: report.cohorts.length,
        remainingInvites,
      },
    }
  },
})
