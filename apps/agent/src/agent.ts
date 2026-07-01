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
export const schemas = {
  daily_brief: z.object({ projectLimit: z.number().int().min(1).max(20).default(8) }),
  capture_task: projectRefSchema.extend({
    title: z.string().min(1).max(120),
    description: z.string().max(2000).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    assigneeSubject: z.string().optional(),
  }),
  move_task: projectRefSchema.extend({
    taskId: z.string().optional(),
    taskTitle: z.string().optional(),
    status: statusSchema,
    position: z.number().optional(),
  }),
  complete_task: projectRefSchema.extend({
    taskId: z.string().optional(),
    taskTitle: z.string().optional(),
  }),
  check_in_project: projectRefSchema,
  summarize_project: projectRefSchema,
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
  lastWorkedAt?: number
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
    lastWorkedAt: iso(project.lastWorkedAt),
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

export type NeramApi = {
  projects(): Promise<Project[]>
  tasks(projectId: string): Promise<Task[]>
  assignedTasks(): Promise<Array<Task & { projectName: string }>>
  activity(limit: number): Promise<Activity[]>
  createTask(args: z.infer<typeof schemas.capture_task> & { projectId: string }): Promise<string>
  moveTask(args: { taskId: string; status: Status; position?: number }): Promise<void>
  checkIn(projectId: string): Promise<number>
}

export function createConvexApi(convexUrl: string, token: string): NeramApi {
  const client = new ConvexHttpClient(convexUrl)
  client.setAuth(token)
  return {
    projects: () => client.query(api.projects.list, {}) as Promise<Project[]>,
    tasks: (projectId) => client.query(api.tasks.list, { projectId }) as Promise<Task[]>,
    assignedTasks: () => client.query(api.tasks.listAll, {}) as Promise<Array<Task & { projectName: string }>>,
    activity: async (limit) => {
      const page = await client.query(api.activity.list, {
        paginationOpts: { cursor: null, numItems: limit },
      }) as { page: Activity[] }
      return page.page
    },
    createTask: (args) => client.mutation(api.tasks.create, args) as Promise<string>,
    moveTask: async (args) => {
      await client.mutation(api.tasks.move, args)
    },
    checkIn: (projectId) => client.mutation(api.projects.markWorked, { projectId }) as Promise<number>,
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
  async function resolveTask(input: z.infer<typeof schemas.move_task>) {
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
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      return {
        projects: allProjects.length,
        staleProjects: allProjects.filter((p) => (p.lastWorkedAt ?? 0) < weekAgo).slice(0, 10).map(compactProject),
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
      const taskId = await resolveTask({ ...input, status: "done" })
      await neram.moveTask({ taskId, status: "done" })
      return { taskId, status: "done" }
    },
    async check_in_project(raw: z.input<typeof schemas.check_in_project>) {
      const project = await resolveProject(schemas.check_in_project.parse(raw))
      const lastWorkedAt = await neram.checkIn(project._id)
      return { projectId: project._id, projectName: project.name, lastWorkedAt: iso(lastWorkedAt) }
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
