import type { FunctionReturnType } from "convex/server"
import type { LucideIcon } from "lucide-react"
import { Circle, CircleCheck, CircleDot } from "lucide-react"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"

const statuses = ["todo", "inProgress", "done"] as const

export type Status = (typeof statuses)[number]

/** Single source of truth for how each status reads everywhere (columns, cards, selects). */
export const statusMeta: Record<Status, { label: string; icon: LucideIcon }> = {
  todo: { label: "Todo", icon: Circle },
  inProgress: { label: "In Progress", icon: CircleDot },
  done: { label: "Done", icon: CircleCheck },
}

export const columns = statuses.map((key) => ({
  key,
  ...statusMeta[key],
}))

/** A board card from a single-project `tasks.list` query. */
export type Task = FunctionReturnType<typeof api.tasks.list>[number]

/**
 * A board card that may also carry project display fields (from
 * `tasks.listAll` on the cross-project Tasks page).
 */
export type BoardTask = Task & {
  projectName?: string
  projectIcon?: string
  projectColor?: string
}

/**
 * Computes the fractional `position` for a task dropped at `insertIndex` within
 * a destination column. `dest` is the column's tasks sorted by position (it may
 * still contain the moving task when reordering within the same column).
 */
export function positionFor(
  dest: Array<{ _id: Id<"tasks">; position: number }>,
  insertIndex: number,
  movingId: Id<"tasks">
) {
  const list = dest.filter((task) => task._id !== movingId)
  let adjusted = 0
  for (let i = 0; i < insertIndex && i < dest.length; i++) {
    if (dest[i]._id !== movingId) adjusted++
  }
  const before = list[adjusted - 1]
  const after = list[adjusted]
  if (!before && !after) return Date.now()
  if (!before) return after.position - 1
  if (!after) return before.position + 1
  return (before.position + after.position) / 2
}

export function DropIndicator() {
  return <div className="h-0.5 rounded-full bg-primary/70" />
}
