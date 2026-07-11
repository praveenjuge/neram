"use client"

import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  CalendarClock,
  CheckCircle2,
  MoreHorizontal,
  Trash2,
} from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { AssigneeSelect, UNASSIGNED } from "@/components/assignee-select"
import { DueDatePicker } from "@/components/due-date-picker"
import { ProjectSelect } from "@/components/project-select"
import { TaskComments } from "@/components/project-board/task-comments"
import { TaskSubtasks } from "@/components/project-board/task-subtasks"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { dataFromError, messageFromError } from "@/lib/errors"

import { columns, type Status } from "./board-shared"

export function TaskDialog({
  taskId,
  commentId,
  onClose,
  onProjectChange,
}: {
  taskId: Id<"tasks"> | null
  commentId: Id<"taskComments"> | null
  onClose: () => void
  onProjectChange: (projectId: Id<"projects">) => void
}) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={taskId !== null}>
      <DialogContent
        className="max-h-[calc(100vh-2rem)] max-w-6xl gap-0 overflow-y-auto p-0 sm:max-w-6xl"
        data-testid="task-dialog"
      >
        <DialogTitle className="sr-only">Task details</DialogTitle>
        {taskId ? (
          <TaskView
            commentId={commentId}
            onClose={onClose}
            onProjectChange={onProjectChange}
            taskId={taskId}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function TaskView({
  taskId,
  commentId,
  onClose,
  onProjectChange,
}: {
  taskId: Id<"tasks">
  commentId: Id<"taskComments"> | null
  onClose: () => void
  onProjectChange: (projectId: Id<"projects">) => void
}) {
  const task = useQuery(api.tasks.get, { taskId })
  if (task === undefined) {
    return (
      <div className="grid min-h-96 place-items-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }
  if (task === null) {
    return (
      <div className="grid min-h-96 place-items-center gap-3 p-8 text-center">
        <div>
          <p className="font-medium">Task unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It was deleted, moved somewhere you cannot access, or the link is
            invalid.
          </p>
        </div>
        <Button onClick={onClose} variant="outline">
          Close
        </Button>
      </div>
    )
  }
  return (
    <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(15rem,1fr)]">
      <main className="grid content-start gap-7 p-5 sm:p-7">
        <InlineFields task={task} />
        <Separator />
        <TaskSubtasks taskId={task._id} />
        <Separator />
        <TaskComments targetCommentId={commentId} taskId={task._id} />
      </main>
      <TaskMetadata
        onClose={onClose}
        onProjectChange={onProjectChange}
        task={task}
      />
    </div>
  )
}

type TaskDetail = NonNullable<FunctionReturnType<typeof api.tasks.get>>

function InlineFields({ task }: { task: TaskDetail }) {
  const update = useMutation(api.tasks.update)
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [conflict, setConflict] = useState<{
    field: "title" | "description"
    latestValue: string
  } | null>(null)
  const cancelTitle = useRef(false)
  const cancelDescription = useRef(false)

  async function saveTitle(expectedTitle = task.title) {
    const next = title.trim()
    if (!next || next === task.title) return
    try {
      await update({ taskId: task._id, title: next, expectedTitle })
      setConflict(null)
    } catch (error) {
      const data = dataFromError(error)
      if (data?.code === "EDIT_CONFLICT") {
        setConflict({
          field: "title",
          latestValue: String(data.latestValue ?? ""),
        })
        return
      }
      toast.error(messageFromError(error, "Could not update the title."))
    }
  }

  async function saveDescription(
    expectedDescription = task.description ?? null
  ) {
    if (description.trim() === (task.description ?? "")) return
    try {
      await update({
        taskId: task._id,
        description,
        expectedDescription,
      })
      setConflict(null)
    } catch (error) {
      const data = dataFromError(error)
      if (data?.code === "EDIT_CONFLICT") {
        setConflict({
          field: "description",
          latestValue: String(data.latestValue ?? ""),
        })
        return
      }
      toast.error(messageFromError(error, "Could not update the description."))
    }
  }

  function conflictActions(field: "title" | "description") {
    if (conflict?.field !== field) return null
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-500/10 p-2 text-xs">
        <span className="mr-auto">This field changed elsewhere.</span>
        <Button
          onClick={() => {
            if (field === "title") setTitle(conflict.latestValue)
            else setDescription(conflict.latestValue)
            setConflict(null)
          }}
          size="xs"
          variant="ghost"
        >
          Use latest
        </Button>
        <Button
          onClick={() =>
            void (field === "title"
              ? saveTitle(conflict.latestValue)
              : saveDescription(conflict.latestValue || null))
          }
          size="xs"
          variant="outline"
        >
          Keep mine
        </Button>
      </div>
    )
  }

  return (
    <section className="grid gap-3">
      <Input
        aria-label="Task title"
        className="h-auto border-0 px-0 font-heading text-xl font-medium shadow-none focus-visible:ring-0"
        maxLength={120}
        onBlur={() => {
          setEditingTitle(false)
          if (cancelTitle.current) cancelTitle.current = false
          else void saveTitle()
        }}
        onChange={(event) => setTitle(event.target.value)}
        onFocus={() => {
          if (conflict?.field !== "title") setTitle(task.title)
          setEditingTitle(true)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
          if (event.key === "Escape") {
            cancelTitle.current = true
            setTitle(task.title)
            event.currentTarget.blur()
          }
        }}
        value={editingTitle || conflict?.field === "title" ? title : task.title}
      />
      {conflictActions("title")}
      <Textarea
        aria-label="Task description"
        className="min-h-28 resize-y border-0 bg-muted/35 px-3 py-2 shadow-none focus-visible:ring-1"
        maxLength={2000}
        onBlur={() => {
          setEditingDescription(false)
          if (cancelDescription.current) cancelDescription.current = false
          else void saveDescription()
        }}
        onChange={(event) => setDescription(event.target.value)}
        onFocus={() => {
          if (conflict?.field !== "description") {
            setDescription(task.description ?? "")
          }
          setEditingDescription(true)
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault()
            event.currentTarget.blur()
          }
          if (event.key === "Escape") {
            cancelDescription.current = true
            setDescription(task.description ?? "")
            event.currentTarget.blur()
          }
        }}
        placeholder="Add a description…"
        value={
          editingDescription || conflict?.field === "description"
            ? description
            : (task.description ?? "")
        }
      />
      {conflictActions("description")}
    </section>
  )
}

function TaskMetadata({
  task,
  onClose,
  onProjectChange,
}: {
  task: TaskDetail
  onClose: () => void
  onProjectChange: (projectId: Id<"projects">) => void
}) {
  const update = useMutation(api.tasks.update)
  const move = useMutation(api.tasks.move)
  const changeProject = useMutation(api.tasks.changeProject)
  const remove = useMutation(api.tasks.remove)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function changeStatus(status: Status) {
    try {
      await move({ taskId: task._id, status })
    } catch (error) {
      const data = dataFromError(error)
      if (
        data?.code === "INCOMPLETE_SUBTASKS" &&
        window.confirm(
          `${String(data.unfinishedCount)} subtasks are unfinished. Mark this task Done anyway?`
        )
      ) {
        await move({
          taskId: task._id,
          status,
          confirmIncompleteSubtasks: true,
        })
        return
      }
      toast.error(messageFromError(error, "Could not change the status."))
    }
  }

  async function moveProject(projectId: Id<"projects">) {
    try {
      await changeProject({ taskId: task._id, projectId })
      onProjectChange(projectId)
    } catch (error) {
      toast.error(messageFromError(error, "Could not move the task."))
    }
  }

  return (
    <aside className="border-t bg-muted/25 p-5 lg:border-t-0 lg:border-l lg:p-6">
      <div className="grid gap-5 lg:sticky lg:top-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Task details
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Task actions" size="icon-sm" variant="ghost">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 /> Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select
            onValueChange={(value) => void changeStatus(value as Status)}
            value={task.status}
          >
            <SelectTrigger data-testid="task-status-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {columns.map((column) => (
                <SelectItem key={column.key} value={column.key}>
                  <column.icon /> {column.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ProjectSelect
          id={`task-project-${task._id}`}
          onChange={(projectId) => void moveProject(projectId)}
          value={task.projectId}
        />
        <div className="grid gap-2">
          <Label>Due date</Label>
          <DueDatePicker
            onChange={(dueDate) => void update({ taskId: task._id, dueDate })}
            value={task.dueDate ?? ""}
          />
        </div>
        <AssigneeSelect
          id={`task-assignee-${task._id}`}
          onChange={(subject, name) =>
            void update({
              taskId: task._id,
              assigneeSubject: subject === UNASSIGNED ? "" : subject,
              assigneeName: name ?? undefined,
            })
          }
          value={task.assigneeSubject ?? UNASSIGNED}
        />
        <div className="grid gap-2 rounded-xl border bg-background/60 p-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5" />
            {task.completedSubtasks}/{task.totalSubtasks} subtasks complete
          </span>
          <span className="flex items-center gap-2">
            <CalendarClock className="size-3.5" />
            Updated {new Date(task.updatedAt).toLocaleString()}
          </span>
          <span>Created {new Date(task.createdAt).toLocaleString()}</span>
        </div>
        {confirmDelete ? (
          <div className="grid gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm">
              Delete this task, {task.totalSubtasks} subtasks, and{" "}
              {task.activeCommentCount} active comments?
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setConfirmDelete(false)}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                data-testid="confirm-delete-task-button"
                onClick={() =>
                  void remove({ taskId: task._id, confirmCascade: true })
                    .then(() => {
                      toast.success("Task deleted.")
                      onClose()
                    })
                    .catch((error) =>
                      toast.error(
                        messageFromError(error, "Could not delete the task.")
                      )
                    )
                }
                size="sm"
                variant="destructive"
              >
                <Trash2 /> Delete
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
