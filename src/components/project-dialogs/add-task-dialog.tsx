import { useMutation } from "convex/react"
import { Plus } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"

import { api } from "../../../convex/_generated/api"
import { messageFromError } from "@/lib/errors"
import { createTaskOptimistic } from "@/lib/optimistic"
import { DueDatePicker } from "@/components/due-date-picker"
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
import { Textarea } from "@/components/ui/textarea"

import { type ProjectRefProps, useControlledOpen } from "./shared"

export function AddTaskDialog({
  id,
  name,
  open: openProp,
  onOpenChange,
  trigger,
}: ProjectRefProps) {
  const createTask = useMutation(api.tasks.create).withOptimisticUpdate(
    createTaskOptimistic(id)
  )
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")

  // Clear the form each time the dialog opens.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setTitle("")
      setDescription("")
      setDueDate("")
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) {
      toast.error("Task title is required.")
      return
    }

    // Fire optimistically: the project's Todo count bumps immediately on the
    // dashboard card, and a failure rolls it back with a toast.
    void createTask({
      projectId: id,
      title: nextTitle.slice(0, 120),
      description: description || undefined,
      dueDate: dueDate || undefined,
    })
      .then(() => toast.success("Task added."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not add the task."))
      )
    setOpen(false)
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add task</DialogTitle>
          <DialogDescription>
            New tasks start in the Todo column of {name}.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor={`add-task-title-${id}`}>Title</Label>
            <Input
              autoFocus
              data-testid="add-task-title-input"
              id={`add-task-title-${id}`}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Draft the homepage copy"
              value={title}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`add-task-description-${id}`}>
              Description (optional)
            </Label>
            <Textarea
              data-testid="add-task-description-input"
              id={`add-task-description-${id}`}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add more detail about this task"
              value={description}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`add-task-due-date-${id}`}>
              Due date (optional)
            </Label>
            <DueDatePicker
              id={`add-task-due-date-${id}`}
              onChange={setDueDate}
              testId="add-task-due-date-input"
              value={dueDate}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button data-testid="add-task-button" type="submit">
              <Plus /> Add task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
