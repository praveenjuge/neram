import { ConvexHttpClient } from "convex/browser"
import { anyApi } from "convex/server"
import { ConvexError } from "convex/values"
import * as z from "zod/v3"

const api = anyApi

export const statusSchema = z.enum(["todo", "inProgress", "done"])
export const projectRefSchema = z.object({
  projectId: z.string().optional(),
  project: z.string().min(1).optional(),
})
// A task can be addressed by its id, or by an (unambiguous) project + title.
export const taskRefSchema = projectRefSchema.extend({
  taskId: z.string().optional(),
  taskTitle: z.string().optional(),
})
const titleSchema = z.string().min(1).max(120)
const descriptionSchema = z.string().max(2000)
const dueDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const projectNameSchema = z.string().min(1).max(80)
export const schemas = {
  daily_brief: z.object({ projectLimit: z.number().int().min(1).max(20).default(8) }),
  capture_task: projectRefSchema.extend({
    title: titleSchema,
    description: descriptionSchema.optional(),
    dueDate: dueDateSchema.optional(),
    assigneeSubject: z.string().optional(),
  }),
  move_task: taskRefSchema.extend({
    status: statusSchema,
    position: z.number().optional(),
  }),
  complete_task: taskRefSchema,
  summarize_project: projectRefSchema,
  workspace_status: z.object({}),
  list_projects: z.object({}),
  list_tasks: projectRefSchema.extend({ status: statusSchema.optional() }),
  update_task: taskRefSchema.extend({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    dueDate: dueDateSchema.optional(),
    clearAssignee: z.boolean().optional(),
  }),
  delete_task: taskRefSchema,
  move_task_to_project: taskRefSchema.extend({
    toProjectId: z.string().optional(),
    toProject: z.string().min(1).optional(),
  }),
  create_project: z.object({
    name: projectNameSchema,
    icon: z.string().optional(),
    color: z.string().optional(),
  }),
  update_project: projectRefSchema.extend({
    name: projectNameSchema.optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
  }),
  // Deleting a project purges every task in it, so require an explicit id
  // rather than resolving a (possibly ambiguous) name.
  delete_project: z.object({ projectId: z.string().min(1) }),
  recent_activity: z.object({ limit: z.number().int().min(1).max(50).default(12) }),
}

// Stable output shapes for the small, non-evolving tool results. The large
// digest tools (daily_brief, summarize_project) and the list tools keep their
// shapes open while they evolve, so they get no output schema.
export const outputSchemas = {
  capture_task: z.object({
    taskId: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    title: z.string(),
    status: statusSchema,
  }),
  move_task: z.object({ taskId: z.string(), status: statusSchema }),
  complete_task: z.object({ taskId: z.string(), status: statusSchema }),
  update_task: z.object({ taskId: z.string() }),
  delete_task: z.object({ taskId: z.string(), deleted: z.boolean() }),
  move_task_to_project: z.object({
    taskId: z.string(),
    projectId: z.string(),
    projectName: z.string(),
  }),
  create_project: z.object({ projectId: z.string(), name: z.string() }),
  update_project: z.object({ projectId: z.string() }),
  delete_project: z.object({ projectId: z.string(), deleted: z.boolean() }),
}

type Status = z.infer<typeof statusSchema>
type Project = {
  _id: string
  name: string
  role: "owner" | "editor"
  taskCount: number
  todoCount: number
  inProgressCount: number
  doneCount: number
  updatedAt: number
}
type Task = {
  _id: string
  projectId: string
  title: string
  description?: string
  dueDate?: string
  status: Status
  assigneeSubject?: string
  assigneeName?: string
  updatedAt: number
}
type Activity = {
  actorName: string
  projectName: string
  type: string
  taskTitle?: string
  toStatus?: Status
  createdAt: number
}

export type WorkspaceStatus = {
  identity: { name?: string; email?: string }
  workspace: {
    projects: number
    ownedProjects: number
    sharedProjects: number
    openTasks: number
  }
}

export class AgentError extends Error {
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.code = code
    this.details = details
  }
}

function iso(value?: number) {
  return value ? new Date(value).toISOString() : undefined
}

function compactProject(project: Project) {
  return {
    projectId: project._id,
    name: project.name,
    role: project.role,
    taskCount: project.taskCount,
    openTasks: project.todoCount + project.inProgressCount,
    updatedAt: iso(project.updatedAt),
  }
}

function compactTask(task: Task & { projectName?: string }) {
  return {
    taskId: task._id,
    projectId: task.projectId,
    projectName: task.projectName,
    title: task.title,
    description: task.description,
    status: task.status,
    dueDate: task.dueDate,
    assigneeName: task.assigneeName,
    updatedAt: iso(task.updatedAt),
  }
}

function compactActivity(activity: Activity) {
  return {
    type: activity.type,
    projectName: activity.projectName,
    taskTitle: activity.taskTitle,
    toStatus: activity.toStatus,
    actorName: activity.actorName,
    createdAt: iso(activity.createdAt),
  }
}

export type CompactProject = ReturnType<typeof compactProject>
export type CompactTask = ReturnType<typeof compactTask>
export type CompactActivity = ReturnType<typeof compactActivity>

export type NeramApi = {
  projects(): Promise<Project[]>
  tasks(projectId: string): Promise<Task[]>
  assignedTasks(): Promise<Array<Task & { projectName: string }>>
  activity(limit: number): Promise<Activity[]>
  createTask(args: z.infer<typeof schemas.capture_task> & { projectId: string }): Promise<string>
  updateTask(args: {
    taskId: string
    title?: string
    description?: string
    dueDate?: string
    assigneeSubject?: string
  }): Promise<void>
  moveTask(args: { taskId: string; status: Status; position?: number }): Promise<void>
  changeTaskProject(args: { taskId: string; projectId: string }): Promise<void>
  removeTask(taskId: string): Promise<void>
  createProject(args: { name: string; icon?: string; color?: string }): Promise<string>
  updateProject(args: { projectId: string; name?: string; icon?: string; color?: string }): Promise<void>
  removeProject(projectId: string): Promise<void>
  status(): Promise<WorkspaceStatus>
}

/** A ready token string, or a provider resolved fresh on each request. */
export type TokenProvider = string | (() => Promise<string>)

export function createConvexApi(convexUrl: string, token: TokenProvider): NeramApi {
  const client = new ConvexHttpClient(convexUrl)
  const resolveToken = typeof token === "function" ? token : async () => token
  // Re-authenticate before every call so a long-lived client (the MCP server)
  // always carries a fresh id token instead of the one pinned at startup.
  async function auth() {
    client.setAuth(await resolveToken())
  }
  async function query<T>(fn: unknown, args: Record<string, unknown>): Promise<T> {
    await auth()
    return client.query(fn as typeof api.projects.list, args) as Promise<T>
  }
  async function mutation<T>(fn: unknown, args: Record<string, unknown>): Promise<T> {
    await auth()
    return client.mutation(fn as typeof api.tasks.create, args) as Promise<T>
  }
  return {
    projects: () => query<Project[]>(api.projects.list, {}),
    tasks: (projectId) => query<Task[]>(api.tasks.list, { projectId }),
    assignedTasks: () => query<Array<Task & { projectName: string }>>(api.tasks.listAll, {}),
    activity: async (limit) => {
      const page = await query<{ page: Activity[] }>(api.activity.list, {
        paginationOpts: { cursor: null, numItems: limit },
      })
      return page.page
    },
    createTask: (args) => mutation<string>(api.tasks.create, args),
    updateTask: async (args) => {
      await mutation(api.tasks.update, args)
    },
    moveTask: async (args) => {
      await mutation(api.tasks.move, args)
    },
    changeTaskProject: async (args) => {
      await mutation(api.tasks.changeProject, args)
    },
    removeTask: async (taskId) => {
      await mutation(api.tasks.remove, { taskId })
    },
    createProject: (args) => mutation<string>(api.projects.create, args),
    updateProject: async (args) => {
      await mutation(api.projects.update, args)
    },
    removeProject: async (projectId) => {
      await mutation(api.projects.remove, { projectId })
    },
    status: () => query<WorkspaceStatus>(api.agent.status, {}),
  }
}

export function createTools(neram: NeramApi) {
  async function projects() {
    return await neram.projects()
  }
  async function resolveProject(ref: z.infer<typeof projectRefSchema>) {
    const list = await projects()
    if (ref.projectId) {
      const found = list.find((p) => p._id === ref.projectId)
      if (!found) throw new AgentError("NOT_FOUND", "Project not found.")
      return found
    }
    if (!ref.project) throw new AgentError("VALIDATION", "Provide projectId or project.")
    const needle = ref.project.trim().toLowerCase()
    const exact = list.filter((p) => p.name.toLowerCase() === needle)
    const matches = exact.length ? exact : list.filter((p) => p.name.toLowerCase().includes(needle))
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) {
      throw new AgentError("AMBIGUOUS", "Project name is ambiguous.", {
        matches: matches.map((p) => ({ projectId: p._id, name: p.name })),
      })
    }
    throw new AgentError("NOT_FOUND", "Project not found.")
  }
  async function resolveTask(input: z.infer<typeof taskRefSchema>) {
    if (input.taskId) return input.taskId
    const project = await resolveProject(input)
    if (!input.taskTitle) throw new AgentError("VALIDATION", "Provide taskId or taskTitle.")
    const tasks = await neram.tasks(project._id)
    const needle = input.taskTitle.trim().toLowerCase()
    const exact = tasks.filter((t) => t.title.toLowerCase() === needle)
    const matches = exact.length ? exact : tasks.filter((t) => t.title.toLowerCase().includes(needle))
    if (matches.length === 1) return matches[0]._id
    if (matches.length > 1) {
      throw new AgentError("AMBIGUOUS", "Task title is ambiguous.", {
        matches: matches.map((t) => ({ taskId: t._id, title: t.title, status: t.status })),
      })
    }
    throw new AgentError("NOT_FOUND", "Task not found.")
  }

  return {
    async daily_brief(raw: z.input<typeof schemas.daily_brief>) {
      const { projectLimit } = schemas.daily_brief.parse(raw)
      const [allProjects, assigned, recent] = await Promise.all([
        projects(),
        neram.assignedTasks(),
        neram.activity(12),
      ])
      const selected = allProjects.slice(0, projectLimit)
      const boards = await Promise.all(selected.map((p) => neram.tasks(p._id)))
      const openTasks = boards.flat().filter((t) => t.status !== "done").slice(0, 40)
      return {
        projects: allProjects.length,
        assignedOpenTasks: assigned.filter((t) => t.status !== "done").slice(0, 20).map(compactTask),
        openTasks: openTasks.map(compactTask),
        recentActivity: recent.map(compactActivity),
        suggestedNextActions: openTasks
          .filter((t) => t.status === "inProgress" || t.dueDate)
          .slice(0, 8)
          .map((t) => ({ taskId: t._id, projectId: t.projectId, title: t.title, status: t.status, dueDate: t.dueDate })),
      }
    },
    async capture_task(raw: z.input<typeof schemas.capture_task>) {
      const input = schemas.capture_task.parse(raw)
      const project = await resolveProject(input)
      const taskId = await neram.createTask({
        projectId: project._id,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        assigneeSubject: input.assigneeSubject,
      })
      return { taskId, projectId: project._id, projectName: project.name, title: input.title, status: "todo" }
    },
    async move_task(raw: z.input<typeof schemas.move_task>) {
      const input = schemas.move_task.parse(raw)
      const taskId = await resolveTask(input)
      await neram.moveTask({ taskId, status: input.status, position: input.position })
      return { taskId, status: input.status }
    },
    async complete_task(raw: z.input<typeof schemas.complete_task>) {
      const input = schemas.complete_task.parse(raw)
      const taskId = await resolveTask(input)
      await neram.moveTask({ taskId, status: "done" })
      return { taskId, status: "done" as const }
    },
    async summarize_project(raw: z.input<typeof schemas.summarize_project>) {
      const project = await resolveProject(schemas.summarize_project.parse(raw))
      const tasks = await neram.tasks(project._id)
      return {
        project: compactProject(project),
        tasks: tasks.slice(0, 80).map(compactTask),
        counts: {
          todo: tasks.filter((t) => t.status === "todo").length,
          inProgress: tasks.filter((t) => t.status === "inProgress").length,
          done: tasks.filter((t) => t.status === "done").length,
        },
      }
    },
    async workspace_status(raw?: z.input<typeof schemas.workspace_status>) {
      schemas.workspace_status.parse(raw ?? {})
      return await neram.status()
    },
    async list_projects(raw?: z.input<typeof schemas.list_projects>) {
      schemas.list_projects.parse(raw ?? {})
      const list = await projects()
      return { projects: list.map(compactProject) }
    },
    async list_tasks(raw: z.input<typeof schemas.list_tasks>) {
      const input = schemas.list_tasks.parse(raw)
      const project = await resolveProject(input)
      const tasks = await neram.tasks(project._id)
      const filtered = input.status ? tasks.filter((t) => t.status === input.status) : tasks
      return { project: compactProject(project), tasks: filtered.slice(0, 200).map(compactTask) }
    },
    async update_task(raw: z.input<typeof schemas.update_task>) {
      const input = schemas.update_task.parse(raw)
      const taskId = await resolveTask(input)
      await neram.updateTask({
        taskId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        // An empty string clears the assignee on the backend; omit the field
        // entirely to leave the current assignment untouched.
        ...(input.clearAssignee ? { assigneeSubject: "" } : {}),
      })
      return { taskId }
    },
    async delete_task(raw: z.input<typeof schemas.delete_task>) {
      const input = schemas.delete_task.parse(raw)
      const taskId = await resolveTask(input)
      await neram.removeTask(taskId)
      return { taskId, deleted: true as const }
    },
    async move_task_to_project(raw: z.input<typeof schemas.move_task_to_project>) {
      const input = schemas.move_task_to_project.parse(raw)
      const taskId = await resolveTask(input)
      const destination = await resolveProject({ projectId: input.toProjectId, project: input.toProject })
      await neram.changeTaskProject({ taskId, projectId: destination._id })
      return { taskId, projectId: destination._id, projectName: destination.name }
    },
    async create_project(raw: z.input<typeof schemas.create_project>) {
      const input = schemas.create_project.parse(raw)
      const projectId = await neram.createProject({ name: input.name, icon: input.icon, color: input.color })
      return { projectId, name: input.name }
    },
    async update_project(raw: z.input<typeof schemas.update_project>) {
      const input = schemas.update_project.parse(raw)
      const project = await resolveProject(input)
      await neram.updateProject({ projectId: project._id, name: input.name, icon: input.icon, color: input.color })
      return { projectId: project._id }
    },
    async delete_project(raw: z.input<typeof schemas.delete_project>) {
      const { projectId } = schemas.delete_project.parse(raw)
      await neram.removeProject(projectId)
      return { projectId, deleted: true as const }
    },
    async recent_activity(raw?: z.input<typeof schemas.recent_activity>) {
      const { limit } = schemas.recent_activity.parse(raw ?? {})
      const activity = await neram.activity(limit)
      return { activity: activity.map(compactActivity) }
    },
  }
}

export function toAgentError(error: unknown) {
  if (error instanceof AgentError) return error
  if (error instanceof ConvexError) {
    const data = error.data
    if (typeof data === "object" && data && "code" in data && "message" in data) {
      return new AgentError(String(data.code), String(data.message))
    }
  }
  const message = error instanceof Error ? error.message : "Unexpected error."
  return new AgentError("INTERNAL", message)
}
