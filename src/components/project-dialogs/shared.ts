import { type ReactNode, useCallback, useState } from "react"

import type { Id } from "../../../convex/_generated/dataModel"

/**
 * Project dialogs are shared between the dashboard cards and the sidebar's
 * per-project action menu. Each one supports two ways of being opened:
 * - Uncontrolled: pass a `trigger` (a `DialogTrigger` node). The dialog tracks
 *   its own open state, used by the dashboard buttons.
 * - Controlled: pass `open` + `onOpenChange` and no trigger, used by the
 *   sidebar where a DropdownMenu opens the dialog programmatically.
 */
export type DialogControlProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
}

export type ProjectRefProps = DialogControlProps & {
  id: Id<"projects">
  name: string
}

/** Merge an optional controlled open state with internal uncontrolled state. */
export function useControlledOpen(
  controlledOpen: boolean | undefined,
  onControlledOpenChange: ((open: boolean) => void) | undefined
) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(next)
      onControlledOpenChange?.(next)
    },
    [controlledOpen, onControlledOpenChange]
  )
  return [open, setOpen] as const
}
