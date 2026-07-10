"use client"

import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import {
  positionFor,
  type Status,
} from "@/components/project-board/board-shared"
import { KanbanBoard } from "@/components/project-board/kanban-board"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { parseDueDate } from "@/lib/dates"
import { dataFromError, messageFromError } from "@/lib/errors"
import { moveTaskOptimistic } from "@/lib/optimistic"
import { cn } from "@/lib/utils"

type Task = FunctionReturnType<typeof api.tasks.listAll>[number]

type DueFilter = "overdue" | "dueSoon" | "noDueDate"

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

function matchesDueFilters(task: Task, dueFilters: Set<DueFilter>, today: Date) {
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
      <button
        aria-pressed={active}
        onClick={onClick}
        type="button"
      >
        {children}
      </button>
    </Badge>
  )
}

export function TasksClient() {
  const router = useRouter()
  // "Assigned to me" is the default view; turning it off loads every task
  // across accessible projects. "Unassigned" is client-side and mutually
  // exclusive with assigned-to-me so the chips stay coherent.
  const [assignedToMe, setAssignedToMe] = useState(true)
  const [unassigned, setUnassigned] = useState(false)
  const [dueFilters, setDueFilters] = useState<Set<DueFilter>>(() => new Set())

  // When filtering unassigned-only we need the full set, not just mine.
  const serverAssignedToMe = assignedToMe && !unassigned
  const tasks = useQuery(api.tasks.listAll, {
    assignedToMe: serverAssignedToMe,
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
      if (unassigned && task.assigneeSubject) return false
      if (!matchesDueFilters(task, dueFilters, today)) return false
      return true
    })
  }, [tasks, unassigned, dueFilters])

  function toggleDueFilter(filter: DueFilter) {
    setDueFilters((current) => {
      const next = new Set(current)
      if (next.has(filter)) next.delete(filter)
      else next.add(filter)
      return next
    })
  }

  function onAssignedToMe() {
    setAssignedToMe((value) => {
      const next = !value
      if (next) setUnassigned(false)
      return next
    })
  }

  function onUnassigned() {
    setUnassigned((value) => {
      const next = !value
      if (next) setAssignedToMe(false)
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
        (item) =>
          item.status === status && item.projectId === moving.projectId
      )
      .sort((a, b) => a.position - b.position)
    const position = positionFor(dest, sameProjectIndex, taskId)

    try {
      await moveTask({ taskId, status, position })
    } catch (error) {
      const data = dataFromError(error)
      if (
        data?.code === "INCOMPLETE_SUBTASKS" &&
        window.confirm(
          `${String(data.unfinishedCount)} subtasks are unfinished. Move this task to Done anyway?`
        )
      ) {
        await moveTask({
          taskId,
          status,
          position,
          confirmIncompleteSubtasks: true,
        })
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
        <h1 className="font-heading text-lg font-medium">Tasks</h1>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={assignedToMe} onClick={onAssignedToMe}>
            Assigned to me
          </FilterChip>
          <FilterChip active={unassigned} onClick={onUnassigned}>
            Unassigned
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
        onOpenTask={(taskId) => {
          const task = tasks?.find((item) => item._id === taskId)
          if (task) {
            router.push(`/projects/${task.projectId}?task=${task._id}`, {
              scroll: false,
            })
          }
        }}
        showProject
        tasks={filteredTasks}
      />
    </section>
  )
}
