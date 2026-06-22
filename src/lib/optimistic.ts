import type { OptimisticLocalStore } from "convex/browser"
import type { FunctionReturnType } from "convex/server"

import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

type ProjectSummary = FunctionReturnType<typeof api.projects.list>[number]
type TaskItem = FunctionReturnType<typeof api.tasks.list>[number]
type Status = TaskItem["status"]

type CountDeltas = Partial<
  Record<"taskCount" | "todoCount" | "inProgressCount" | "doneCount", number>
>

const statusCountKey: Record<
  Status,
  "todoCount" | "inProgressCount" | "doneCount"
> = {
  todo: "todoCount",
  inProgress: "inProgressCount",
  done: "doneCount",
}

function applyCounts(
  summary: ProjectSummary,
  deltas: CountDeltas
): ProjectSummary {
  return {
    ...summary,
    taskCount: Math.max(0, summary.taskCount + (deltas.taskCount ?? 0)),
    todoCount: Math.max(0, summary.todoCount + (deltas.todoCount ?? 0)),
    inProgressCount: Math.max(
      0,
      summary.inProgressCount + (deltas.inProgressCount ?? 0)
    ),
    doneCount: Math.max(0, summary.doneCount + (deltas.doneCount ?? 0)),
  }
}

/** Apply a transform to a project's summary in both the list and single-project caches. */
function patchProjectSummaries(
  store: OptimisticLocalStore,
  projectId: Id<"projects">,
  update: (summary: ProjectSummary) => ProjectSummary
) {
  const single = store.getQuery(api.projects.get, { projectId })
  if (single) store.setQuery(api.projects.get, { projectId }, update(single))

  const list = store.getQuery(api.projects.list, {})
  if (list) {
    store.setQuery(
      api.projects.list,
      {},
      list.map((project) =>
        project._id === projectId ? update(project) : project
      )
    )
  }
}

/** Optimistically move/reorder a task and shift the project's counters. */
export function moveTaskOptimistic(projectId: Id<"projects">) {
  return (
    store: OptimisticLocalStore,
    args: { taskId: Id<"tasks">; status: Status; position?: number }
  ) => {
    const tasks = store.getQuery(api.tasks.list, { projectId })
    let from: Status | undefined
    if (tasks) {
      const position = args.position ?? Date.now()
      const next = tasks.map((task) => {
        if (task._id === args.taskId) {
          from = task.status
          return { ...task, status: args.status, position }
        }
        return task
      })
      // Keep the cached list ordered by position so the board renders the new
      // order immediately, before the server confirms.
      next.sort((a, b) => a.position - b.position)
      store.setQuery(api.tasks.list, { projectId }, next)
    }

    if (from && from !== args.status) {
      const deltas: CountDeltas = {}
      deltas[statusCountKey[from]] = -1
      deltas[statusCountKey[args.status]] =
        (deltas[statusCountKey[args.status]] ?? 0) + 1
      patchProjectSummaries(store, projectId, (summary) =>
        applyCounts(summary, deltas)
      )
    }
  }
}

/** Optimistically add a new Todo task to the board and bump the project's counters. */
export function createTaskOptimistic(projectId: Id<"projects">) {
  return (
    store: OptimisticLocalStore,
    args: {
      projectId: Id<"projects">
      title: string
      description?: string
      dueDate?: string
    }
  ) => {
    const tasks = store.getQuery(api.tasks.list, { projectId })
    if (tasks) {
      const now = Date.now()
      const temp: TaskItem = {
        _id: crypto.randomUUID() as Id<"tasks">,
        _creationTime: now,
        projectId,
        title: args.title,
        description: args.description,
        dueDate: args.dueDate,
        status: "todo",
        position: now,
        createdAt: now,
        updatedAt: now,
      }
      store.setQuery(api.tasks.list, { projectId }, [...tasks, temp])
    }
    patchProjectSummaries(store, projectId, (summary) =>
      applyCounts(summary, { taskCount: 1, todoCount: 1 })
    )
  }
}

/** Optimistically apply title/description/due-date edits to a task on the board. */
export function updateTaskOptimistic(projectId: Id<"projects">) {
  return (
    store: OptimisticLocalStore,
    args: {
      taskId: Id<"tasks">
      title?: string
      description?: string
      dueDate?: string
    }
  ) => {
    const tasks = store.getQuery(api.tasks.list, { projectId })
    if (!tasks) return
    store.setQuery(
      api.tasks.list,
      { projectId },
      tasks.map((task) =>
        task._id === args.taskId
          ? {
              ...task,
              title: args.title ?? task.title,
              // Empty strings clear the field, mirroring the server's cleaners.
              description: args.description
                ? args.description
                : args.description === undefined
                  ? task.description
                  : undefined,
              dueDate: args.dueDate
                ? args.dueDate
                : args.dueDate === undefined
                  ? task.dueDate
                  : undefined,
              updatedAt: Date.now(),
            }
          : task
      )
    )
  }
}

/** Optimistically remove a task from the board and drop the project's counters. */
export function removeTaskOptimistic(projectId: Id<"projects">) {
  return (store: OptimisticLocalStore, args: { taskId: Id<"tasks"> }) => {
    const tasks = store.getQuery(api.tasks.list, { projectId })
    if (!tasks) return
    const removed = tasks.find((task) => task._id === args.taskId)
    store.setQuery(
      api.tasks.list,
      { projectId },
      tasks.filter((task) => task._id !== args.taskId)
    )
    if (removed) {
      const deltas: CountDeltas = { taskCount: -1 }
      deltas[statusCountKey[removed.status]] = -1
      patchProjectSummaries(store, projectId, (summary) =>
        applyCounts(summary, deltas)
      )
    }
  }
}

/** Optimistically prepend a new project to the dashboard list. */
export function createProjectOptimistic(
  store: OptimisticLocalStore,
  args: { name: string; icon?: string; color?: string }
) {
  const list = store.getQuery(api.projects.list, {})
  if (!list) return
  const now = Date.now()
  const temp: ProjectSummary = {
    _id: crypto.randomUUID() as Id<"projects">,
    _creationTime: now,
    name: args.name,
    icon: args.icon,
    color: args.color,
    createdAt: now,
    updatedAt: now,
    taskCount: 0,
    todoCount: 0,
    inProgressCount: 0,
    doneCount: 0,
    // The creator is always the owner of their freshly created project.
    role: "owner",
  }
  store.setQuery(api.projects.list, {}, [temp, ...list])
}

/** Optimistically apply name/icon/color edits to a project. */
export function updateProjectOptimistic(
  store: OptimisticLocalStore,
  args: {
    projectId: Id<"projects">
    name?: string
    icon?: string
    color?: string
  }
) {
  patchProjectSummaries(store, args.projectId, (summary) => ({
    ...summary,
    name: args.name ?? summary.name,
    icon: args.icon ?? summary.icon,
    color: args.color ?? summary.color,
    updatedAt: Date.now(),
  }))
}

/** Optimistically remove a project from the dashboard and clear its board cache. */
export function removeProjectOptimistic(
  store: OptimisticLocalStore,
  args: { projectId: Id<"projects"> }
) {
  const list = store.getQuery(api.projects.list, {})
  if (list) {
    store.setQuery(
      api.projects.list,
      {},
      list.filter((project) => project._id !== args.projectId)
    )
  }
  const single = store.getQuery(api.projects.get, { projectId: args.projectId })
  if (single)
    store.setQuery(api.projects.get, { projectId: args.projectId }, null)
}
