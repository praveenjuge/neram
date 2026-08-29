"use client"

import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import {
  positionFor,
  type Status,
} from "@/components/project-board/board-shared"
import { KanbanBoard } from "@/components/project-board/kanban-board"
import { incompleteSubtasksToast } from "@/components/project-board/incomplete-subtasks-toast"
import { NewTaskDialog } from "@/components/project-board/new-task-dialog"
import { TaskDialog } from "@/components/project-board/task-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { parseDueDate } from "@/lib/dates"
import { dataFromError, messageFromError } from "@/lib/errors"
import { moveTaskOptimistic } from "@/lib/optimistic"
import { cn } from "@/lib/utils"
import { workspaceHref } from "@/lib/workspace"

type Task = FunctionReturnType<typeof api.tasks.listAll>[number]

type DueFilter = "overdue" | "dueSoon" | "noDueDate"

type AssigneeView = "mine" | "unassigned" | "all"

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function isOverdue(task: Task, today: Date) {
  if (task.status === "done" || !task.dueDate) return false
  const due = parseDueDate(task.dueDate)
  if (!due) return false
  return due < today
}

function isDueSoon(task: Task, today: Date) {
  if (task.status === "done" || !task.dueDate) return false
  const due = parseDueDate(task.dueDate)
  if (!due) return false
  const soonEnd = addDays(today, 7)
  return due >= today && due <= soonEnd
}

function matchesDueFilters(
  task: Task,
  dueFilters: Set<DueFilter>,
  today: Date
) {
  if (dueFilters.size === 0) return true
  if (dueFilters.has("overdue") && isOverdue(task, today)) return true
  if (dueFilters.has("dueSoon") && isDueSoon(task, today)) return true
  if (dueFilters.has("noDueDate") && !task.dueDate) return true
  return false
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Badge
      asChild
      className={cn(
        "h-7 cursor-pointer px-2.5 text-xs select-none",
        !active && "bg-background hover:bg-muted"
      )}
      variant={active ? "default" : "outline"}
    >
      <button aria-pressed={active} onClick={onClick} type="button">
        {children}
      </button>
    </Badge>
  )
}

export function TasksClient() {
  const router = useRouter()
  const params = useParams()
  const organizationSlug =
    typeof params.organizationSlug === "string" ? params.organizationSlug : ""
  const tasksHref = workspaceHref(organizationSlug, "/tasks")
  const searchParams = useSearchParams()
  const urlTaskId = searchParams.get("task") as Id<"tasks"> | null

  // Drive the dialog from local state so it opens instantly on click. The URL
  // mirrors it for deep links and the back button, and state reconciles from
  // the URL on back/forward (same approach as the project board).
  const [openTaskId, setOpenTaskId] = useState<Id<"tasks"> | null>(urlTaskId)
  const [syncedTaskId, setSyncedTaskId] = useState<Id<"tasks"> | null>(
    urlTaskId
  )
  if (urlTaskId !== syncedTaskId) {
    setSyncedTaskId(urlTaskId)
    setOpenTaskId(urlTaskId)
  }

  function openTask(taskId: Id<"tasks">) {
    setOpenTaskId(taskId)
    const next = new URLSearchParams(searchParams.toString())
    next.set("task", taskId)
    next.delete("comment")
    window.history.pushState(
      { ...window.history.state, neramTasksModal: true },
      "",
      `${tasksHref}?${next.toString()}`
    )
  }

  function closeTask() {
    setOpenTaskId(null)
    if (window.history.state?.neramTasksModal) {
      router.back()
      return
    }
    router.replace(tasksHref, { scroll: false })
  }

  // Which assignee slice is on the board; "mine" is the default view. "Mine"
  // is served by the server, "Unassigned" and "All" load every task across
  // accessible projects and filter client-side.
  const [assigneeView, setAssigneeView] = useState<AssigneeView>("mine")
  const [dueFilters, setDueFilters] = useState<Set<DueFilter>>(() => new Set())

  const tasks = useQuery(api.tasks.listAll, {
    assignedToMe: assigneeView === "mine",
  })

  // Discover projectId from the cached listAll result so optimistic updates
  // can patch both the project board cache and the Tasks board cache.
  const moveTask = useMutation(api.tasks.move).withOptimisticUpdate(
    (store, args) => {
      const projectId =
        store
          .getQuery(api.tasks.listAll, { assignedToMe: true })
          ?.find((task) => task._id === args.taskId)?.projectId ??
        store
          .getQuery(api.tasks.listAll, { assignedToMe: false })
          ?.find((task) => task._id === args.taskId)?.projectId
      if (projectId) {
        moveTaskOptimistic(projectId)(store, args)
      }
    }
  )

  const filteredTasks = useMemo(() => {
    if (!tasks) return undefined
    const today = startOfToday()
    return tasks.filter((task) => {
      if (assigneeView === "unassigned" && task.assigneeSubject) return false
      if (!matchesDueFilters(task, dueFilters, today)) return false
      return true
    })
  }, [tasks, assigneeView, dueFilters])

  const hasActiveFilters = assigneeView !== "mine" || dueFilters.size > 0

  function clearFilters() {
    setAssigneeView("mine")
    setDueFilters(new Set())
  }

  function toggleDueFilter(filter: DueFilter) {
    setDueFilters((current) => {
      const next = new Set(current)
      if (next.has(filter)) next.delete(filter)
      else next.add(filter)
      return next
    })
  }

  async function handleDrop(
    taskId: Id<"tasks">,
    status: Status,
    insertIndex: number
  ) {
    // Drop indices come from the filtered board the user is looking at.
    const board = filteredTasks ?? []
    const moving = board.find((item) => item._id === taskId)
    if (!moving) return

    const visualDest = board
      .filter((item) => item.status === status)
      .sort((a, b) => a.position - b.position)

    // Skip the write when the card is dropped back into its current slot.
    if (moving.status === status) {
      const currentIndex = visualDest.findIndex((item) => item._id === taskId)
      if (insertIndex === currentIndex || insertIndex === currentIndex + 1) {
        return
      }
    }

    // Positions are per-project, so map the visual drop index onto the subset
    // of same-project tasks before computing the fractional position.
    let sameProjectIndex = 0
    for (let i = 0; i < insertIndex && i < visualDest.length; i++) {
      const item = visualDest[i]
      if (item._id !== taskId && item.projectId === moving.projectId) {
        sameProjectIndex++
      }
    }
    const dest = board
      .filter(
        (item) => item.status === status && item.projectId === moving.projectId
      )
      .sort((a, b) => a.position - b.position)
    const position = positionFor(dest, sameProjectIndex, taskId)

    try {
      await moveTask({ taskId, status, position })
    } catch (error) {
      if (dataFromError(error)?.code === "INCOMPLETE_SUBTASKS") {
        incompleteSubtasksToast(error, () =>
          moveTask({
            taskId,
            status,
            position,
            confirmIncompleteSubtasks: true,
          })
        )
        return
      }
      toast.error(messageFromError(error, "Could not move the task."))
    }
  }

  if (filteredTasks === undefined) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-5 p-5">
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-lg font-medium">
            Tasks
            {filteredTasks && hasActiveFilters ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {filteredTasks.length} shown
              </span>
            ) : null}
          </h1>
          <div className="flex items-center gap-2">
            {hasActiveFilters ? (
              <Button
                data-testid="clear-tasks-filters"
                onClick={clearFilters}
                size="sm"
                variant="ghost"
              >
                Clear filters
              </Button>
            ) : null}
            <NewTaskDialog />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={assigneeView === "mine"}
            onClick={() => setAssigneeView("mine")}
          >
            Assigned to me
          </FilterChip>
          <FilterChip
            active={assigneeView === "unassigned"}
            onClick={() => setAssigneeView("unassigned")}
          >
            Unassigned
          </FilterChip>
          <FilterChip
            active={assigneeView === "all"}
            onClick={() => setAssigneeView("all")}
          >
            All
          </FilterChip>
          <FilterChip
            active={dueFilters.has("overdue")}
            onClick={() => toggleDueFilter("overdue")}
          >
            Overdue
          </FilterChip>
          <FilterChip
            active={dueFilters.has("dueSoon")}
            onClick={() => toggleDueFilter("dueSoon")}
          >
            Due soon
          </FilterChip>
          <FilterChip
            active={dueFilters.has("noDueDate")}
            onClick={() => toggleDueFilter("noDueDate")}
          >
            No due date
          </FilterChip>
        </div>
      </div>
      <KanbanBoard
        onDrop={handleDrop}
        onOpenTask={openTask}
        showProject
        tasks={filteredTasks}
      />
      <TaskDialog
        commentId={null}
        onClose={closeTask}
        onProjectChange={() => undefined}
        taskId={openTaskId}
      />
    </section>
  )
}
