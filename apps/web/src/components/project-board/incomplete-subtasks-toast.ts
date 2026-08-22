import { toast } from "sonner"

import { dataFromError, messageFromError } from "@/lib/errors"

/**
 * The backend rejects marking a task done while subtasks are open
 * (INCOMPLETE_SUBTASKS). Instead of a blocking window.confirm, surface a
 * toast whose action retries the move with `confirmIncompleteSubtasks`.
 */
export function incompleteSubtasksToast(
  error: unknown,
  retry: () => Promise<unknown>,
  fallbackMessage = "Could not move the task."
) {
  const raw = Number(dataFromError(error)?.unfinishedCount ?? 0)
  const count = Number.isFinite(raw) ? raw : 0
  toast.warning(`${count} subtask${count === 1 ? "" : "s"} still open`, {
    action: {
      label: "Move anyway",
      onClick: () => {
        void retry().catch((retryError) =>
          toast.error(messageFromError(retryError, fallbackMessage))
        )
      },
    },
    description:
      "Marking a task Done normally requires all of its subtasks to be finished.",
  })
}
