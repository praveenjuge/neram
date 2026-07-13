"use client"

import { useOrganization } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"
import { CalendarPlus, Pencil, RotateCcw } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { messageFromError } from "@/lib/errors"

import { GoalEditor } from "./goal-editor"
import {
  InfoHint,
  Loading,
  RemoveTaskButton,
  runToast,
  SprintHeader,
  sprintLabel,
} from "./shared"
import { SprintNameDialog } from "./sprint-name-dialog"

const CURRENT_HINT =
  "The active Sprint. Its dates are locked — drag tasks across the board to update status."

export function CurrentSprint() {
  const current = useQuery(api.sprints.current)
  const moveTask = useMutation(api.tasks.move)
  const renameSprint = useMutation(api.sprints.renameSprint)
  const createSprint = useMutation(api.sprints.scheduleSprint)
  const [openTaskId, setOpenTaskId] = useState<Id<"tasks"> | null>(null)

  if (current === undefined) return <Loading />
  if (current === null)
    return (
      <div className="grid place-items-center gap-3 rounded-lg border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No active Sprint. Create one to start planning.
        </p>
        <SprintNameDialog
          defaultName="Sprint 1"
          description="Name your first Sprint. It becomes the active Sprint and starts today."
          onSubmit={(name) =>
            runToast(createSprint({ name }), {
              success: "Started a new Sprint.",
              error: "Could not create the Sprint.",
            })
          }
          submitLabel="Create Sprint"
          title="New Sprint"
          trigger={
            <Button>
              <CalendarPlus /> New Sprint
            </Button>
          }
        />
      </div>
    )
  const currentSprint = current

  async function handleDrop(
    taskId: Id<"tasks">,
    status: Status,
    insertIndex: number
  ) {
    const moving = currentSprint.tasks.find((task) => task._id === taskId)
    if (!moving) return
    const destination = currentSprint.tasks
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

  const removable = current.tasks.filter((task) => task.status !== "done")

  return (
    <div className="grid gap-5">
      <SprintHeader
        {...current.sprint}
        action={
          <>
            <SprintNameDialog
              defaultName={sprintLabel(current.sprint)}
              description="Update this Sprint's name."
              onSubmit={(name) =>
                runToast(renameSprint({ sprint: "current", name }), {
                  success: "Renamed the Sprint.",
                  error: "Could not rename the Sprint.",
                })
              }
              submitLabel="Save"
              title="Rename Sprint"
              trigger={
                <Button
                  aria-label="Rename Sprint"
                  size="icon-sm"
                  variant="ghost"
                >
                  <Pencil />
                </Button>
              }
            />
            <EarlyRollover />
          </>
        }
        hint={CURRENT_HINT}
        state="Current"
      />
      <GoalEditor initialGoal={current.sprint.goal} sprint="current" />
      {removable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            Return to Backlog
            <InfoHint text="Takes a task out of this Sprint and back to the Backlog." />
          </span>
          {removable.map((task) => (
            <span
              className="flex items-center rounded-md border pl-2 text-xs"
              key={task._id}
            >
              <span className="max-w-40 truncate">{task.title}</span>
              <RemoveTaskButton sprint="current" task={task} />
            </span>
          ))}
        </div>
      ) : null}
      <KanbanBoard
        onDrop={handleDrop}
        onOpenTask={setOpenTaskId}
        showProject
        tasks={current.tasks}
      />
      <TaskDialog
        commentId={null}
        onClose={() => setOpenTaskId(null)}
        onProjectChange={() => undefined}
        taskId={openTaskId}
      />
    </div>
  )
}

function EarlyRollover() {
  const { organization } = useOrganization()
  const rollover = useMutation(api.sprints.rollover)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <RotateCcw /> Roll over early
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Roll over this Sprint early?</DialogTitle>
          <DialogDescription>
            Unfinished work will carry into Upcoming. This is audited and cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="rollover-reason">Reason</Label>
          <Textarea
            id="rollover-reason"
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!organization?.slug || !reason.trim()}
            onClick={() => {
              if (!organization?.slug) return
              runToast(
                rollover({
                  organizationId: organization.id,
                  slug: organization.slug,
                  confirm: true,
                  reason: reason.trim(),
                }),
                {
                  success: "Sprint rollover started.",
                  error: "Could not roll over the Sprint.",
                }
              )
              setOpen(false)
            }}
            variant="destructive"
          >
            Confirm rollover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
