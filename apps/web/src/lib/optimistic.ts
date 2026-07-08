import type { OptimisticLocalStore } from "convex/browser"
import type { FunctionReturnType } from "convex/server"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"

type ProjectSummary = FunctionReturnType<typeof api.projects.list>[number]
type ProjectName = FunctionReturnType<typeof api.projects.names>[number]
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

/**
 * Mirror the server's personal-recency ordering for `projects.list`: most
 * recently worked first, tie-broken by the project's own `updatedAt`, with
 * never-worked projects sorted last.
 */
function byPersonalRecency(a: ProjectSummary, b: ProjectSummary): number {
  if (a.lastWorkedAt !== undefined && b.lastWorkedAt !== undefined) {
    if (b.lastWorkedAt !== a.lastWorkedAt)
      return b.lastWorkedAt - a.lastWorkedAt
    return b.updatedAt - a.updatedAt
  }
  if (a.lastWorkedAt !== undefined) return -1
  if (b.lastWorkedAt !== undefined) return 1
  return b.updatedAt - a.updatedAt
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
      assigneeSubject?: string
      assigneeName?: string
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
        assigneeSubject: args.assigneeSubject,
        assigneeName: args.assigneeName,
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

/** Optimistically apply title/description/due-date/assignee edits to a task. */
export function updateTaskOptimistic(projectId: Id<"projects">) {
  return (
    store: OptimisticLocalStore,
    args: {
      taskId: Id<"tasks">
      title?: string
      description?: string
      dueDate?: string
      assigneeSubject?: string
      assigneeName?: string
    }
  ) => {
    const tasks = store.getQuery(api.tasks.list, { projectId })
    if (!tasks) return
    store.setQuery(
      api.tasks.list,
      { projectId },
      tasks.map((task) => {
        if (task._id !== args.taskId) return task
        // Mirror the server: an empty assigneeSubject clears the assignment,
        // an omitted one leaves it unchanged, anything else sets it.
        let assigneeSubject = task.assigneeSubject
        let assigneeName = task.assigneeName
        if (args.assigneeSubject !== undefined) {
          if (args.assigneeSubject === "") {
            assigneeSubject = undefined
            assigneeName = undefined
          } else {
            assigneeSubject = args.assigneeSubject
            assigneeName = args.assigneeName
          }
        }
        return {
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
          assigneeSubject,
          assigneeName,
          updatedAt: Date.now(),
        }
      })
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

/**
 * Optimistically move a task to another project: drop it (and its counts) from
 * the source board and add it (and its counts) to the destination board. The
 * status carries over and the card appends to the end of the destination. The
 * source project is captured in the closure; the destination arrives in the
 * mutation args.
 */
export function changeProjectTaskOptimistic(sourceProjectId: Id<"projects">) {
  return (
    store: OptimisticLocalStore,
    args: { taskId: Id<"tasks">; projectId: Id<"projects"> }
  ) => {
    const destinationProjectId = args.projectId
    // Nothing to do if the task is already in the requested project.
    if (destinationProjectId === sourceProjectId) return

    const sourceTasks = store.getQuery(api.tasks.list, {
      projectId: sourceProjectId,
    })
    const moving = sourceTasks?.find((task) => task._id === args.taskId)

    // Remove the card from the source board and shift its counts down.
    if (sourceTasks) {
      store.setQuery(
        api.tasks.list,
        { projectId: sourceProjectId },
        sourceTasks.filter((task) => task._id !== args.taskId)
      )
    }
    if (moving) {
      const deltas: CountDeltas = { taskCount: -1 }
      deltas[statusCountKey[moving.status]] = -1
      patchProjectSummaries(store, sourceProjectId, (summary) =>
        applyCounts(summary, deltas)
      )
    }

    // Add the card to the destination board (when it's cached) and shift its
    // counts up. The destination list may not be loaded if that board has never
    // been opened; the counters still update via the summary caches.
    if (moving) {
      const destinationTasks = store.getQuery(api.tasks.list, {
        projectId: destinationProjectId,
      })
      if (destinationTasks) {
        const moved: TaskItem = {
          ...moving,
          projectId: destinationProjectId,
          position: Date.now(),
        }
        store.setQuery(api.tasks.list, { projectId: destinationProjectId }, [
          ...destinationTasks,
          moved,
        ])
      }
      const deltas: CountDeltas = { taskCount: 1 }
      deltas[statusCountKey[moving.status]] = 1
      patchProjectSummaries(store, destinationProjectId, (summary) =>
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
    // A brand-new project starts with no personal work state ("Needs love").
    lastWorkedAt: undefined,
  }
  store.setQuery(api.projects.list, {}, [temp, ...list])
}

/**
 * Optimistically record a personal "worked on" check-in: stamp the project's
 * `lastWorkedAt` to now and resort the dashboard list to mirror the server's
 * recency ordering, so the card jumps to the top instantly.
 */
export function markWorkedOptimistic(
  store: OptimisticLocalStore,
  args: { projectId: Id<"projects"> }
) {
  const now = Date.now()
  patchProjectSummaries(store, args.projectId, (summary) => ({
    ...summary,
    lastWorkedAt: now,
  }))
  const list = store.getQuery(api.projects.list, {})
  if (list) {
    store.setQuery(api.projects.list, {}, [...list].sort(byPersonalRecency))
  }
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

/**
 * Optimistically remove a project from the dashboard, the archived list, and
 * clear its board cache. Deletion happens from the Archived page, so the
 * archived list is the one the user is looking at when it fires.
 */
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
  const archived = store.getQuery(api.projects.listArchived, {})
  if (archived) {
    store.setQuery(
      api.projects.listArchived,
      {},
      archived.filter((project) => project._id !== args.projectId)
    )
  }
  const single = store.getQuery(api.projects.get, { projectId: args.projectId })
  if (single)
    store.setQuery(api.projects.get, { projectId: args.projectId }, null)
}

/**
 * Optimistically archive a project: drop it from the active dashboard list and
 * prepend it to the archived list (when that cache is loaded) so it moves over
 * instantly. Mirrors the server, which hides archived projects from every
 * active list.
 */
export function archiveProjectOptimistic(
  store: OptimisticLocalStore,
  args: { projectId: Id<"projects"> }
) {
  const list = store.getQuery(api.projects.list, {})
  let moved: ProjectSummary | undefined
  if (list) {
    moved = list.find((project) => project._id === args.projectId)
    store.setQuery(
      api.projects.list,
      {},
      list.filter((project) => project._id !== args.projectId)
    )
  }
  // The sidebar reads a separate `names` cache; drop the project there too so
  // it doesn't linger in the sidebar until the server refetch lands.
  const names = store.getQuery(api.projects.names, {})
  if (names) {
    store.setQuery(
      api.projects.names,
      {},
      names.filter((project) => project._id !== args.projectId)
    )
  }
  const archived = store.getQuery(api.projects.listArchived, {})
  if (archived && moved) {
    store.setQuery(api.projects.listArchived, {}, [moved, ...archived])
  }
}

/**
 * Optimistically unarchive a project: drop it from the archived list and add it
 * back to the active dashboard list (when that cache is loaded), resorted to
 * mirror the server's personal-recency ordering.
 */
export function unarchiveProjectOptimistic(
  store: OptimisticLocalStore,
  args: { projectId: Id<"projects"> }
) {
  const archived = store.getQuery(api.projects.listArchived, {})
  let moved: ProjectSummary | undefined
  if (archived) {
    moved = archived.find((project) => project._id === args.projectId)
    store.setQuery(
      api.projects.listArchived,
      {},
      archived.filter((project) => project._id !== args.projectId)
    )
  }
  const list = store.getQuery(api.projects.list, {})
  if (list && moved) {
    store.setQuery(
      api.projects.list,
      {},
      [moved, ...list].sort(byPersonalRecency)
    )
  }
  // Restore the project to the sidebar's separate `names` cache as well, rebuilt
  // from the summary (openCount = todo + in-progress), so it reappears instantly.
  const names = store.getQuery(api.projects.names, {})
  if (names && moved && !names.some((p) => p._id === moved!._id)) {
    const entry: ProjectName = {
      _id: moved._id,
      name: moved.name,
      icon: moved.icon,
      color: moved.color,
      role: moved.role,
      openCount: moved.todoCount + moved.inProgressCount,
      lastWorkedAt: moved.lastWorkedAt,
    }
    store.setQuery(api.projects.names, {}, [entry, ...names])
  }
}
