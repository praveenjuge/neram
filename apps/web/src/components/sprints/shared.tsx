"use client"

import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { format } from "date-fns"
import { Info, Undo2 } from "lucide-react"
import type { ReactNode } from "react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { messageFromError } from "@/lib/errors"

export type SprintTask = NonNullable<
  FunctionReturnType<typeof api.sprints.current>
>["tasks"][number]

// Where a planning action applies: the active Sprint, the soonest scheduled
// Sprint, or a specific scheduled Sprint addressed by id.
export type SprintTarget = "current" | "upcoming" | Id<"sprints">

/**
 * Run a mutation and surface the outcome as a toast. Centralizes the
 * success/`messageFromError` pattern that used to be copy-pasted per action.
 */
export function runToast(
  promise: Promise<unknown>,
  messages: { success: string; error: string }
) {
  void promise
    .then(() => toast.success(messages.success))
    .catch((error) => toast.error(messageFromError(error, messages.error)))
}

export function dateRange(startsAt: number, endsAt: number) {
  return `${format(startsAt, "MMM d")} – ${format(endsAt, "MMM d, yyyy")}`
}

/** Display name for a Sprint, falling back to "Sprint {number}" when unnamed. */
export function sprintLabel(sprint: { name?: string; number: number }) {
  return sprint.name?.trim() || `Sprint ${sprint.number}`
}

export function Loading() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  )
}

/** Small info icon that reveals an explanatory tooltip on hover/focus. */
export function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={text}
        className="inline-flex text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        type="button"
      >
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

export function SprintHeader({
  number,
  name,
  startsAt,
  endsAt,
  state,
  hint,
  action,
  details,
  taskCount,
}: {
  number: number
  name?: string
  startsAt: number
  endsAt: number
  state: "Current" | "Upcoming"
  hint: string
  action?: ReactNode
  details?: ReactNode
  taskCount: number
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="grid gap-1">
          <h2 className="flex flex-wrap items-center gap-2 font-heading text-base font-medium">
            {sprintLabel({ name, number })}
            <Badge variant="secondary">{state}</Badge>
            <InfoHint text={hint} />
          </h2>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{dateRange(startsAt, endsAt)}</span>
            <span aria-hidden>·</span>
            <span>
              {taskCount} open {taskCount === 1 ? "task" : "tasks"}
            </span>
          </p>
        </div>
        {details}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

export function RemoveTaskButton({
  task,
  sprint,
}: {
  task: Pick<SprintTask, "_id" | "title">
  sprint: SprintTarget
}) {
  const remove = useMutation(api.sprints.remove)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={`Return ${task.title} to Backlog`}
          onClick={() =>
            runToast(remove({ taskIds: [task._id], sprint }), {
              success: "Task returned to Backlog.",
              error: "Could not remove the task.",
            })
          }
          size="icon-sm"
          variant="ghost"
        >
          <Undo2 />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Return to Backlog</TooltipContent>
    </Tooltip>
  )
}
