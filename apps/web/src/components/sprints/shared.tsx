"use client"

import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { format } from "date-fns"
import { Info, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
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

export function dateRange(startsAt: number, endsAt?: number) {
  return endsAt
    ? `${format(startsAt, "MMM d")} – ${format(endsAt, "MMM d, yyyy")}`
    : `Started ${format(startsAt, "MMM d, yyyy")}`
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

export function RemoveTaskButton({
  task,
}: {
  task: Pick<SprintTask, "_id" | "title">
}) {
  const remove = useMutation(api.sprints.remove)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={`Return ${task.title} to Backlog`}
          onClick={() =>
            runToast(remove({ taskIds: [task._id] }), {
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
