import { useMutation } from "convex/react"
import { Plus } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { AssigneeSelect, UNASSIGNED } from "@/components/assignee-select"
import { DueDatePicker } from "@/components/due-date-picker"
import { messageFromError } from "@/lib/errors"
import { createTaskOptimistic } from "@/lib/optimistic"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SprintSelect, type SprintPlacement } from "@/components/sprint-select"
import { Textarea } from "@/components/ui/textarea"

export function NewTaskDialog({ projectId }: { projectId: Id<"projects"> }) {
  const createTask = useMutation(api.tasks.create).withOptimisticUpdate(
    createTaskOptimistic(projectId)
  )
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [assigneeSubject, setAssigneeSubject] = useState(UNASSIGNED)
  const [assigneeName, setAssigneeName] = useState<string | null>(null)
  const [sprint, setSprint] = useState<SprintPlacement>("backlog")

  function reset() {
    setTitle("")
    setDescription("")
    setDueDate("")
    setAssigneeSubject(UNASSIGNED)
    setAssigneeName(null)
    setSprint("backlog")
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) {
      toast.error("Task title is required.")
      return
    }

    // Fire optimistically: the card appears instantly, so close the dialog now
    // and surface only failures. The optimistic update rolls back on error.
    void createTask({
      projectId,
      title: nextTitle.slice(0, 120),
      description: description || undefined,
      dueDate: dueDate || undefined,
      assigneeSubject:
        assigneeSubject === UNASSIGNED ? undefined : assigneeSubject,
      assigneeName:
        assigneeSubject === UNASSIGNED
          ? undefined
          : (assigneeName ?? undefined),
      sprint,
    })
      .then(() => toast.success("Task added."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not add the task."))
      )
    reset()
    setOpen(false)
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button data-testid="new-task-trigger">
          <Plus /> Add task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add task</DialogTitle>
          <DialogDescription>
            New tasks start in the Todo column.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              autoFocus
              data-testid="task-title-input"
              id="task-title"
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Draft the homepage copy"
              value={title}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-description">Description (optional)</Label>
            <Textarea
              data-testid="task-description-input"
              id="task-description"
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add more detail about this task"
              value={description}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-due-date">Due date (optional)</Label>
            <DueDatePicker
              id="task-due-date"
              onChange={setDueDate}
              testId="task-due-date-input"
              value={dueDate}
            />
          </div>
          <AssigneeSelect
            enabled={open}
            id="task-assignee"
            onChange={(subject, name) => {
              setAssigneeSubject(subject)
              setAssigneeName(name)
            }}
            value={assigneeSubject}
          />
          <SprintSelect id="task-sprint" onChange={setSprint} value={sprint} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button data-testid="create-task-button" type="submit">
              <Plus /> Add task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
