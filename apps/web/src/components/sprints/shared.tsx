"use client"

import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { format } from "date-fns"
import { Info, X } from "lucide-react"
import type { ReactNode } from "react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
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
  startsAt,
  endsAt,
  state,
  hint,
  action,
}: {
  number: number
  startsAt: number
  endsAt: number
  state: "Current" | "Upcoming"
  hint: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-1.5 font-heading text-base font-medium">
          {state} · Sprint {number}
          <InfoHint text={hint} />
        </h2>
        <p className="text-sm text-muted-foreground">
          {dateRange(startsAt, endsAt)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {action}
        <Badge variant="outline">{state}</Badge>
      </div>
    </div>
  )
}

export function RemoveTaskButton({
  task,
  sprint,
}: {
  task: SprintTask
  sprint: "current" | "upcoming"
}) {
  const remove = useMutation(api.sprints.remove)
  return (
    <Button
      aria-label={`Remove ${task.title} from ${sprint}`}
      onClick={() =>
        runToast(remove({ taskIds: [task._id], sprint }), {
          success: "Task returned to Backlog.",
          error: "Could not remove the task.",
        })
      }
      size="icon-sm"
      variant="ghost"
    >
      <X />
    </Button>
  )
}
