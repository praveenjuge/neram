import { useMutation, useQuery } from "convex/react"
import { Plus } from "lucide-react"
import type { FormEvent, ReactNode } from "react"
import { useState } from "react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { useControlledOpen } from "@/components/project-dialogs/shared"
import { AssigneeSelect, UNASSIGNED } from "@/components/assignee-select"
import { DueDatePicker } from "@/components/due-date-picker"
import { ProjectSelect } from "@/components/project-select"
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
import { Textarea } from "@/components/ui/textarea"

/**
 * The one task-create dialog, shared by every surface:
 * - Pass `projectId` to pin the target project (dashboard rows, sidebar menu,
 *   a project board) — the project picker is hidden.
 * - Omit it to let the user pick a project (global Tasks board).
 * Opening works uncontrolled with a `trigger`, or controlled via `open` +
 * `onOpenChange` (the sidebar's dropdown menu).
 */
export function NewTaskDialog({
  projectId,
  open: openProp,
  onOpenChange,
  trigger,
}: {
  projectId?: Id<"projects">
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
}) {
  const projects = useQuery(api.projects.names)
  const createTask = useMutation(api.tasks.create).withOptimisticUpdate(
    (store, args) => createTaskOptimistic(args.projectId)(store, args)
  )
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange)
  const [selectedProjectId, setSelectedProjectId] = useState<
    Id<"projects"> | undefined
  >(projectId)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [assigneeSubject, setAssigneeSubject] = useState(UNASSIGNED)
  const [assigneeName, setAssigneeName] = useState<string | null>(null)
  // Optional fields stay collapsed so quick capture is just title + submit.
  const [showDetails, setShowDetails] = useState(false)
  const effectiveProjectId =
    selectedProjectId ?? projectId ?? projects?.[0]?._id

  // Clear the form each time the dialog opens. Runs during render on the
  // open-state transition so it also covers controlled opens (the sidebar's
  // dropdown), where the Dialog's own onOpenChange never fires.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setTitle("")
      setDescription("")
      setDueDate("")
      setAssigneeSubject(UNASSIGNED)
      setAssigneeName(null)
      setShowDetails(false)
      setSelectedProjectId(projectId ?? projects?.[0]?._id)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) {
      toast.error("Task title is required.")
      return
    }
    if (!effectiveProjectId) {
      toast.error("Choose a project for this task.")
      return
    }

    // Fire optimistically: the card appears instantly and is its own
    // confirmation, so no success toast; only failures surface.
    void createTask({
      projectId: effectiveProjectId,
      title: nextTitle.slice(0, 120),
      description: description || undefined,
      dueDate: dueDate || undefined,
      assigneeSubject:
        assigneeSubject === UNASSIGNED ? undefined : assigneeSubject,
      assigneeName:
        assigneeSubject === UNASSIGNED
          ? undefined
          : (assigneeName ?? undefined),
    }).catch((error) =>
      toast.error(messageFromError(error, "Could not add the task."))
    )
    setOpen(false)
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          setTitle("")
          setDescription("")
          setDueDate("")
          setAssigneeSubject(UNASSIGNED)
          setAssigneeName(null)
          setShowDetails(false)
          setSelectedProjectId(projectId ?? projects?.[0]?._id)
        }
      }}
      open={open}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            New tasks start in the Todo column
            {projectId ? "" : " of the chosen project"}.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          {!projectId ? (
            <ProjectSelect
              enabled={open}
              id="task-project"
              onChange={setSelectedProjectId}
              value={effectiveProjectId}
            />
          ) : null}
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
          {showDetails ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="task-description">Description</Label>
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
                <Label htmlFor="task-due-date">Due date</Label>
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
            </>
          ) : null}
          <button
            className="-mt-1 w-fit text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => setShowDetails((value) => !value)}
            type="button"
          >
            {showDetails ? "Hide details" : "Add details"}
          </button>
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
