import type { FunctionReturnType } from "convex/server"
import { Circle, CircleCheck, CircleDot } from "lucide-react"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"

export const columns = [
  { key: "todo", label: "Todo", icon: Circle },
  { key: "inProgress", label: "In Progress", icon: CircleDot },
  { key: "done", label: "Done", icon: CircleCheck },
] as const

export type Status = (typeof columns)[number]["key"]
export type Task = FunctionReturnType<typeof api.tasks.list>[number]

/**
 * Computes the fractional `position` for a task dropped at `insertIndex` within
 * a destination column. `dest` is the column's tasks sorted by position (it may
 * still contain the moving task when reordering within the same column).
 */
export function positionFor(
  dest: Task[],
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
