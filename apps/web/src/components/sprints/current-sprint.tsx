"use client"

import { useMutation, useQuery } from "convex/react"
import { differenceInCalendarDays } from "date-fns"
import { ListPlus, Play, Square } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import {
  positionFor,
  type Status,
} from "@/components/project-board/board-shared"
import { KanbanBoard } from "@/components/project-board/kanban-board"
import { TaskDialog } from "@/components/project-board/task-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { messageFromError } from "@/lib/errors"

import { BacklogPicker } from "./backlog-picker"
import { GoalEditor } from "./goal-editor"
import { dateRange, Loading, RemoveTaskButton, runToast } from "./shared"
import { StartSprintDialog } from "./start-sprint-dialog"

export function CurrentSprint() {
  const current = useQuery(api.sprints.current)
  const moveTask = useMutation(api.tasks.move)
  const [openTaskId, setOpenTaskId] = useState<Id<"tasks"> | null>(null)

  if (current === undefined) return <Loading />
  if (current === null) return <EmptyFocus />

  const sprintView = current
  const openTasks = sprintView.tasks.filter((task) => task.status !== "done")
  const completed = sprintView.tasks.length - openTasks.length
  const progress = sprintView.tasks.length
    ? Math.round((completed / sprintView.tasks.length) * 100)
    : 0

  async function handleDrop(
    taskId: Id<"tasks">,
    status: Status,
    insertIndex: number
  ) {
    const moving = sprintView.tasks.find((task) => task._id === taskId)
    if (!moving) return
    const destination = sprintView.tasks
      .filter(
        (task) => task.status === status && task.projectId === moving.projectId
      )
      .sort((a, b) => a.position - b.position)
    try {
      await moveTask({
        taskId,
        status,
        position: positionFor(destination, insertIndex, taskId),
      })
    } catch (error) {
      toast.error(messageFromError(error, "Could not move the task."))
    }
  }

  return (
    <div className="grid gap-6">
      <header className="grid gap-4 border-b pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1">
            <p className="text-sm font-medium">
              {dateRange(current.sprint.startsAt, current.sprint.endsAt)}
            </p>
            <p className="text-xs text-muted-foreground">
              {timeRemaining(current.sprint.endsAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <BacklogSheet />
            <EndSprintButton unfinished={openTasks.length} />
          </div>
        </div>
        <GoalEditor initialGoal={current.sprint.goal} />
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Sprint progress</span>
            <span className="font-medium">
              {completed} of {current.tasks.length} completed
            </span>
          </div>
          <div
            aria-label={`${progress}% complete`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>
      {openTasks.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {current.tasks.length === 0
              ? "Choose a few Backlog tasks to focus on."
              : "Everything in this Sprint is complete."}
          </p>
          <BacklogSheet />
        </div>
      ) : (
        <KanbanBoard
          onDrop={handleDrop}
          onOpenTask={setOpenTaskId}
          renderTaskAction={(task) => <RemoveTaskButton task={task} />}
          showProject
          tasks={openTasks}
          visibleStatuses={["todo", "inProgress"]}
        />
      )}
      <TaskDialog
        commentId={null}
        onClose={() => setOpenTaskId(null)}
        onProjectChange={() => undefined}
        taskId={openTaskId}
      />
    </div>
  )
}

function EmptyFocus() {
  return (
    <div className="grid min-h-[55vh] place-items-center rounded-xl border border-dashed p-8 text-center">
      <div className="grid max-w-sm justify-items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
          <Play className="size-5" />
        </span>
        <h2 className="font-heading text-xl font-medium">
          Choose what matters now
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Start an optional Sprint with an empty focus list. Your projects and
          Backlog keep working even when no Sprint is active.
        </p>
        <StartSprintDialog trigger={<Button>Start a Sprint</Button>} />
      </div>
    </div>
  )
}

function BacklogSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm">
          <ListPlus /> Add from Backlog
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Add focused work</SheetTitle>
          <SheetDescription>
            Choose only the tasks that matter in this Sprint.
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <BacklogPicker />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function EndSprintButton({ unfinished }: { unfinished: number }) {
  const end = useMutation(api.sprints.end)
  const [open, setOpen] = useState(false)

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Square /> End Sprint
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End this Sprint?</DialogTitle>
          <DialogDescription>
            The Sprint will be saved to History. {unfinished} unfinished task
            {unfinished === 1 ? "" : "s"} will return to Backlog, and the next
            Sprint will start empty.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => {
              runToast(end({ confirm: true }), {
                success: "Sprint is closing.",
                error: "Could not end the Sprint.",
              })
              setOpen(false)
            }}
          >
            End Sprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function timeRemaining(endsAt?: number) {
  if (!endsAt) return "No fixed end date"
  const days = Math.max(0, differenceInCalendarDays(endsAt, Date.now()))
  if (days === 0) return "Ends today"
  return `${days} day${days === 1 ? "" : "s"} remaining`
}
