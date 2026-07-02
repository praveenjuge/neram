import { useMutation } from "convex/react"
import { Pencil, Trash2 } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { AssigneeSelect, UNASSIGNED } from "@/components/assignee-select"
import { DueDatePicker } from "@/components/due-date-picker"
import { ProjectSelect } from "@/components/project-select"
import { messageFromError } from "@/lib/errors"
import {
  changeProjectTaskOptimistic,
  moveTaskOptimistic,
  removeTaskOptimistic,
  updateTaskOptimistic,
} from "@/lib/optimistic"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { columns, type Status, type Task } from "./board-shared"

export function TaskDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Rendered once at the board level; only mount the editable content while a
  // task is selected so its form hooks always have a concrete task to work on.
  if (!task) return null
  return (
    <TaskDialogContent onOpenChange={onOpenChange} open={open} task={task} />
  )
}

function TaskDialogContent({
  task,
  open,
  onOpenChange,
}: {
  task: Task
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateTask = useMutation(api.tasks.update).withOptimisticUpdate(
    updateTaskOptimistic(task.projectId)
  )
  const moveTask = useMutation(api.tasks.move).withOptimisticUpdate(
    moveTaskOptimistic(task.projectId)
  )
  const removeTask = useMutation(api.tasks.remove).withOptimisticUpdate(
    removeTaskOptimistic(task.projectId)
  )
  const changeProjectTask = useMutation(
    api.tasks.changeProject
  ).withOptimisticUpdate(changeProjectTaskOptimistic(task.projectId))

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")
  const [dueDate, setDueDate] = useState(task.dueDate ?? "")
  const [assigneeSubject, setAssigneeSubject] = useState(
    task.assigneeSubject ?? UNASSIGNED
  )
  const [assigneeName, setAssigneeName] = useState<string | null>(
    task.assigneeName ?? null
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  // The status dropdown is a quick action: changing it moves the card to the
  // end of the target column immediately (mirroring the old "Move" menu), while
  // title/description/due-date edits are persisted with "Save changes".
  function onStatusChange(next: Status) {
    if (next === task.status) return
    void moveTask({ taskId: task._id, status: next })
      .then(() => toast.success("Task moved."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not move the task."))
      )
  }

  // Changing the project is a quick action like the status dropdown: it moves
  // the task to the chosen project immediately. Because the card then belongs to
  // another board, we close this dialog right away (any unsaved title/
  // description edits are discarded, mirroring the status quick action).
  function onProjectChange(next: Id<"projects">) {
    if (next === task.projectId) return
    void changeProjectTask({ taskId: task._id, projectId: next })
      .then(() => toast.success("Task moved to another project."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not move the task."))
      )
    onOpenChange(false)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) {
      toast.error("Task title is required.")
      return
    }

    // Optimistic edit renders instantly, so close right away. Empty strings for
    // description/due date clear those fields on the server.
    void updateTask({
      taskId: task._id,
      title: nextTitle.slice(0, 120),
      description,
      dueDate,
      // Always send the current selection: a subject to (re)assign or an empty
      // string to clear. The optimistic update needs the name too.
      assigneeSubject: assigneeSubject === UNASSIGNED ? "" : assigneeSubject,
      assigneeName:
        assigneeSubject === UNASSIGNED
          ? undefined
          : (assigneeName ?? undefined),
    })
      .then(() => toast.success("Task updated."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not update the task."))
      )
    onOpenChange(false)
  }

  function onDelete() {
    // Optimistic remove drops the card immediately; close and let it run.
    void removeTask({ taskId: task._id })
      .then(() => toast.success("Task deleted."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not delete the task."))
      )
    onOpenChange(false)
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent data-testid="task-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-muted-foreground" /> Edit task
          </DialogTitle>
          <DialogDescription>
            Update the details, change the status, or delete this task.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor={`edit-task-title-${task._id}`}>Title</Label>
            <Input
              autoFocus
              data-testid="edit-task-title-input"
              id={`edit-task-title-${task._id}`}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Draft the homepage copy"
              value={title}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`edit-task-description-${task._id}`}>
              Description (optional)
            </Label>
            <Textarea
              data-testid="edit-task-description-input"
              id={`edit-task-description-${task._id}`}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add more detail about this task"
              value={description}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`edit-task-status-${task._id}`}>Status</Label>
            <Select
              onValueChange={(value) => onStatusChange(value as Status)}
              value={task.status}
            >
              <SelectTrigger
                className="w-full"
                data-testid="task-status-select"
                id={`edit-task-status-${task._id}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => {
                  const Icon = column.icon
                  return (
                    <SelectItem
                      data-testid={`status-option-${column.key}`}
                      key={column.key}
                      value={column.key}
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      {column.label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <ProjectSelect
            enabled={open}
            id={`edit-task-project-${task._id}`}
            onChange={onProjectChange}
            value={task.projectId}
          />
          <div className="grid gap-2">
            <Label htmlFor={`edit-task-due-date-${task._id}`}>
              Due date (optional)
            </Label>
            <DueDatePicker
              id={`edit-task-due-date-${task._id}`}
              onChange={setDueDate}
              testId="edit-task-due-date-input"
              value={dueDate}
            />
          </div>
          <AssigneeSelect
            enabled={open}
            id={`edit-task-assignee-${task._id}`}
            onChange={(subject, name) => {
              setAssigneeSubject(subject)
              setAssigneeName(name)
            }}
            projectId={task.projectId}
            value={assigneeSubject}
          />
          {confirmDelete ? (
            <div className="grid gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-muted-foreground">
                This permanently deletes the task. This can't be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setConfirmDelete(false)}
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  data-testid="confirm-delete-task-button"
                  onClick={onDelete}
                  type="button"
                  variant="destructive"
                >
                  <Trash2 /> Delete task
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            <Button
              className={confirmDelete ? "invisible" : undefined}
              data-testid="delete-task-trigger"
              onClick={() => setConfirmDelete(true)}
              type="button"
              variant="destructive"
            >
              <Trash2 /> Delete
            </Button>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button data-testid="save-task-button" type="submit">
                Save changes
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
