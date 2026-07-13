import * as z from "zod/v3"

import { schemas } from "./schemas.js"

export type OrganizationRole = "org:admin" | "org:member"
export type SprintPlacement = "backlog" | "current" | "upcoming"
export type SprintRef = "current" | "upcoming"

export type Organization = {
  organizationId: string
  slug: string
  name: string
  state: "active" | "deleting"
}

export type OrganizationMember = {
  membershipId: string
  userId: string
  role: OrganizationRole
  displayName: string
  email?: string
  imageUrl?: string
}

export type OrganizationSettings = {
  cadenceWeeks: number
  startWeekday: number
  timezone: string
  nextSprintNumber: number
}

export type WorkspaceContext = {
  organization: Organization
  membership: OrganizationMember
  settings: OrganizationSettings | null
}

export type Sprint = {
  _id: string
  number: number
  name?: string
  goal?: string
  state: "current" | "upcoming" | "closed"
  startsAt: number
  endsAt: number
  closedAt?: number
  earlyCloseReason?: string
  baselineCount?: number
  completedCount?: number
  carriedCount?: number
  addedCount?: number
  removedCount?: number
  reopenedCount?: number
}

export type SprintTask = {
  _id: string
  projectId: string
  projectName: string
  title: string
  description?: string
  dueDate?: string
  status: "todo" | "inProgress" | "done"
  assigneeName?: string
  currentSprintId?: string
  upcomingSprintId?: string
  completedAt?: number
  totalSubtasks: number
  completedSubtasks: number
  activeCommentCount: number
  updatedAt: number
}

export type SprintEntry = {
  _id: string
  sprintId: string
  taskId: string
  projectId: string
  projectNameSnapshot: string
  taskTitleSnapshot: string
  origin: "planned" | "carried" | "scope_added" | "reopened"
  actorName: string
  addedAt: number
  removedAt?: number
  removalReason?: string
  creditedCompletionAt?: number
  carriedToSprintId?: string
  priorCompletionSprintId?: string
}

type Page<T> = { page: T[]; isDone: boolean; continueCursor: string }
type SprintView = { sprint: Sprint; tasks: SprintTask[] }

export type PlanningApi = {
  syncCurrentWorkspace(): Promise<void>
  currentWorkspace(): Promise<WorkspaceContext>
  workspaceMembers(): Promise<OrganizationMember[]>
  createWorkspace(args: { name: string; slug?: string }): Promise<Organization>
  inviteWorkspaceMember(args: {
    email: string
    role: OrganizationRole
  }): Promise<{ invitationId: string; status: string }>
  updateWorkspaceMemberRole(args: {
    userId: string
    role: OrganizationRole
  }): Promise<void>
  removeWorkspaceMember(args: {
    organizationId: string
    organizationSlug: string
    userId: string
    confirm: boolean
  }): Promise<void>
  deleteWorkspace(args: {
    organizationId: string
    organizationSlug: string
    confirm: boolean
  }): Promise<string>
  currentSprint(): Promise<SprintView | null>
  upcomingSprint(): Promise<SprintView | null>
  upcomingSprints(): Promise<SprintView[]>
  backlogTasks(): Promise<SprintTask[]>
  sprintHistory(args: {
    cursor: string | null
    pageSize: number
  }): Promise<Page<Sprint>>
  sprintAudit(args: {
    sprintId: string
    cursor: string | null
    pageSize: number
  }): Promise<Page<SprintEntry>>
  // `sprint` is a placement alias ("backlog"/"current"/"upcoming") or a
  // scheduled Sprint id; the backend validates it either way.
  planSprintTasks(args: { taskIds: string[]; sprint: string }): Promise<void>
  removeSprintTasks(args: { taskIds: string[]; sprint: string }): Promise<void>
  updateSprintGoal(args: { sprint: string; goal?: string }): Promise<void>
  updateSprintCadence(args: {
    cadenceWeeks: number
    startWeekday: number
    timezone: string
  }): Promise<void>
  scheduleSprint(args: { name?: string; goal?: string }): Promise<string>
  renameSprint(args: { sprint: string; name?: string }): Promise<void>
  unscheduleSprint(args: { sprintId: string }): Promise<void>
  rolloverSprint(args: {
    organizationId: string
    organizationSlug: string
    confirm: boolean
    reason: string
  }): Promise<string>
}

type Call = <T>(fn: unknown, args: Record<string, unknown>) => Promise<T>

export function createPlanningApi(
  api: Record<string, Record<string, unknown>>,
  calls: { query: Call; mutation: Call; action: Call }
): PlanningApi {
  return {
    syncCurrentWorkspace: async () => {
      await calls.action(api.organizationActions.syncCurrent, {})
    },
    currentWorkspace: () => calls.query(api.organizations.current, {}),
    workspaceMembers: async () => {
      const members: OrganizationMember[] = []
      let cursor: string | null = null
      for (;;) {
        const result: Page<OrganizationMember> = await calls.query(
          api.organizations.members,
          { paginationOpts: { cursor, numItems: 100 } }
        )
        members.push(...result.page)
        if (result.isDone) return members
        cursor = result.continueCursor
      }
    },
    createWorkspace: (args) =>
      calls.action(api.organizationActions.create, args),
    inviteWorkspaceMember: (args) =>
      calls.action(api.organizationActions.invite, args),
    updateWorkspaceMemberRole: async (args) => {
      await calls.action(api.organizationActions.updateRole, args)
    },
    removeWorkspaceMember: async (args) => {
      await calls.action(api.organizationActions.removeMember, args)
    },
    deleteWorkspace: ({ organizationSlug, ...args }) =>
      calls.mutation(api.organizations.beginDeletion, {
        ...args,
        slug: organizationSlug,
      }),
    currentSprint: () => calls.query(api.sprints.current, {}),
    upcomingSprint: () => calls.query(api.sprints.upcoming, {}),
    upcomingSprints: () => calls.query(api.sprints.upcomingList, {}),
    backlogTasks: () => calls.query(api.sprints.backlog, {}),
    sprintHistory: ({ cursor, pageSize }) =>
      calls.query(api.sprints.history, {
        paginationOpts: { cursor, numItems: pageSize },
      }),
    sprintAudit: ({ sprintId, cursor, pageSize }) =>
      calls.query(api.sprints.audit, {
        sprintId,
        paginationOpts: { cursor, numItems: pageSize },
      }),
    planSprintTasks: async (args) => {
      await calls.mutation(api.sprints.plan, args)
    },
    removeSprintTasks: async (args) => {
      await calls.mutation(api.sprints.remove, args)
    },
    updateSprintGoal: async (args) => {
      await calls.mutation(api.sprints.updateGoal, args)
    },
    updateSprintCadence: async (args) => {
      await calls.mutation(api.sprints.updateCadence, args)
    },
    scheduleSprint: (args) => calls.mutation(api.sprints.scheduleSprint, args),
    renameSprint: async (args) => {
      await calls.mutation(api.sprints.renameSprint, args)
    },
    unscheduleSprint: async (args) => {
      await calls.mutation(api.sprints.unscheduleSprint, args)
    },
    rolloverSprint: ({ organizationSlug, ...args }) =>
      calls.mutation(api.sprints.rollover, {
        ...args,
        slug: organizationSlug,
      }),
  }
}

function iso(value?: number) {
  return value ? new Date(value).toISOString() : undefined
}

function compactSprint(sprint: Sprint) {
  return {
    sprintId: sprint._id,
    number: sprint.number,
    name: sprint.name,
    goal: sprint.goal,
    state: sprint.state,
    startsAt: iso(sprint.startsAt),
    endsAt: iso(sprint.endsAt),
    closedAt: iso(sprint.closedAt),
    earlyCloseReason: sprint.earlyCloseReason,
    counts: {
      baseline: sprint.baselineCount,
      completed: sprint.completedCount,
      carried: sprint.carriedCount,
      added: sprint.addedCount,
      removed: sprint.removedCount,
      reopened: sprint.reopenedCount,
    },
  }
}

function compactSprintTask(task: SprintTask) {
  return {
    taskId: task._id,
    projectId: task.projectId,
    projectName: task.projectName,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    status: task.status,
    assigneeName: task.assigneeName,
    totalSubtasks: task.totalSubtasks,
    completedSubtasks: task.completedSubtasks,
    activeCommentCount: task.activeCommentCount,
    completedAt: iso(task.completedAt),
    updatedAt: iso(task.updatedAt),
  }
}

export function createPlanningTools(neram: PlanningApi) {
  return {
    async get_workspace(raw?: z.input<typeof schemas.get_workspace>) {
      schemas.get_workspace.parse(raw ?? {})
      await neram.syncCurrentWorkspace()
      return await neram.currentWorkspace()
    },
    async create_workspace(raw: z.input<typeof schemas.create_workspace>) {
      const input = schemas.create_workspace.parse(raw)
      const organization = await neram.createWorkspace(input)
      return { ...organization, requiresReauthorization: true as const }
    },
    async list_workspace_members(
      raw?: z.input<typeof schemas.list_workspace_members>
    ) {
      schemas.list_workspace_members.parse(raw ?? {})
      return { members: await neram.workspaceMembers() }
    },
    async invite_workspace_member(
      raw: z.input<typeof schemas.invite_workspace_member>
    ) {
      return await neram.inviteWorkspaceMember(
        schemas.invite_workspace_member.parse(raw)
      )
    },
    async update_workspace_member_role(
      raw: z.input<typeof schemas.update_workspace_member_role>
    ) {
      const input = schemas.update_workspace_member_role.parse(raw)
      await neram.updateWorkspaceMemberRole(input)
      return input
    },
    async remove_workspace_member(
      raw: z.input<typeof schemas.remove_workspace_member>
    ) {
      const input = schemas.remove_workspace_member.parse(raw)
      await neram.removeWorkspaceMember(input)
      return { userId: input.userId, removed: true as const }
    },
    async delete_workspace(raw: z.input<typeof schemas.delete_workspace>) {
      const input = schemas.delete_workspace.parse(raw)
      const jobId = await neram.deleteWorkspace(input)
      return { jobId, deleting: true as const }
    },
    async get_sprint(raw?: z.input<typeof schemas.get_sprint>) {
      const { sprint } = schemas.get_sprint.parse(raw ?? {})
      const view =
        sprint === "current"
          ? await neram.currentSprint()
          : await neram.upcomingSprint()
      return {
        sprint: view ? compactSprint(view.sprint) : null,
        taskCount: view?.tasks.length ?? 0,
      }
    },
    async list_sprint_tasks(raw?: z.input<typeof schemas.list_sprint_tasks>) {
      const { sprint } = schemas.list_sprint_tasks.parse(raw ?? {})
      if (sprint === "backlog") {
        return {
          sprint,
          details: null,
          tasks: (await neram.backlogTasks()).map(compactSprintTask),
        }
      }
      const view =
        sprint === "current"
          ? await neram.currentSprint()
          : await neram.upcomingSprint()
      return {
        sprint,
        details: view ? compactSprint(view.sprint) : null,
        tasks: view?.tasks.map(compactSprintTask) ?? [],
      }
    },
    async sprint_history(raw?: z.input<typeof schemas.sprint_history>) {
      const input = schemas.sprint_history.parse(raw ?? {})
      if (input.sprintId) {
        const result = await neram.sprintAudit({
          sprintId: input.sprintId,
          cursor: input.cursor ?? null,
          pageSize: input.pageSize,
        })
        return {
          sprintId: input.sprintId,
          entries: result.page.map((entry) => ({
            ...entry,
            addedAt: iso(entry.addedAt),
            removedAt: iso(entry.removedAt),
            creditedCompletionAt: iso(entry.creditedCompletionAt),
          })),
          cursor: result.isDone ? null : result.continueCursor,
        }
      }
      const result = await neram.sprintHistory({
        cursor: input.cursor ?? null,
        pageSize: input.pageSize,
      })
      return {
        sprints: result.page.map(compactSprint),
        cursor: result.isDone ? null : result.continueCursor,
      }
    },
    async list_upcoming_sprints(
      raw?: z.input<typeof schemas.list_upcoming_sprints>
    ) {
      schemas.list_upcoming_sprints.parse(raw ?? {})
      const views = await neram.upcomingSprints()
      return {
        sprints: views.map((view) => ({
          ...compactSprint(view.sprint),
          taskCount: view.tasks.length,
          tasks: view.tasks.map(compactSprintTask),
        })),
      }
    },
    async plan_sprint_tasks(raw: z.input<typeof schemas.plan_sprint_tasks>) {
      const input = schemas.plan_sprint_tasks.parse(raw)
      const sprint = input.sprintId ?? input.sprint
      await neram.planSprintTasks({ taskIds: input.taskIds, sprint })
      return { taskIds: input.taskIds, sprint }
    },
    async remove_sprint_tasks(
      raw: z.input<typeof schemas.remove_sprint_tasks>
    ) {
      const input = schemas.remove_sprint_tasks.parse(raw)
      const sprint = input.sprintId ?? input.sprint
      await neram.removeSprintTasks({ taskIds: input.taskIds, sprint })
      return { taskIds: input.taskIds, sprint }
    },
    async update_sprint_goal(raw: z.input<typeof schemas.update_sprint_goal>) {
      const input = schemas.update_sprint_goal.parse(raw)
      const sprint = input.sprintId ?? input.sprint
      await neram.updateSprintGoal({ sprint, goal: input.goal })
      return { sprint }
    },
    async update_sprint_cadence(
      raw: z.input<typeof schemas.update_sprint_cadence>
    ) {
      const input = schemas.update_sprint_cadence.parse(raw)
      await neram.updateSprintCadence(input)
      return input
    },
    async schedule_sprint(raw?: z.input<typeof schemas.schedule_sprint>) {
      const input = schemas.schedule_sprint.parse(raw ?? {})
      const sprintId = await neram.scheduleSprint(input)
      return { sprintId, scheduled: true as const }
    },
    async rename_sprint(raw: z.input<typeof schemas.rename_sprint>) {
      const input = schemas.rename_sprint.parse(raw)
      const sprint = input.sprintId ?? input.sprint
      await neram.renameSprint({ sprint, name: input.name })
      return { sprint }
    },
    async unschedule_sprint(raw: z.input<typeof schemas.unschedule_sprint>) {
      const input = schemas.unschedule_sprint.parse(raw)
      await neram.unscheduleSprint(input)
      return { sprintId: input.sprintId, removed: true as const }
    },
    async rollover_sprint(raw: z.input<typeof schemas.rollover_sprint>) {
      const input = schemas.rollover_sprint.parse(raw)
      const jobId = await neram.rolloverSprint(input)
      return { jobId, started: true as const }
    },
  }
}
