import { addWeeks } from "date-fns"
import { ConvexError } from "convex/values"

export type SprintDuration = 1 | 2 | 4 | "open"

export function validateDuration(value: number | string): SprintDuration {
  if (value !== 1 && value !== 2 && value !== 4 && value !== "open") {
    throw new ConvexError({
      code: "INVALID_DURATION",
      message: "Choose a 1, 2, or 4 week Sprint, or no fixed end date.",
    })
  }
  return value
}

export function sprintBounds(now: number, duration: SprintDuration) {
  return {
    startsAt: now,
    endsAt: duration === "open" ? undefined : addWeeks(now, duration).getTime(),
  }
}
