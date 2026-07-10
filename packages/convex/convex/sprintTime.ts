import { tz } from "@date-fns/tz"
import { addWeeks, startOfWeek } from "date-fns"
import { ConvexError } from "convex/values"

export type SprintCadence = {
  cadenceWeeks: number
  startWeekday: number
  timezone: string
}

export function validateCadence(settings: SprintCadence) {
  if (
    !Number.isInteger(settings.cadenceWeeks) ||
    settings.cadenceWeeks < 1 ||
    settings.cadenceWeeks > 8
  ) {
    throw new ConvexError({
      code: "INVALID_CADENCE",
      message: "Sprint cadence must be between 1 and 8 weeks.",
    })
  }
  if (
    !Number.isInteger(settings.startWeekday) ||
    settings.startWeekday < 0 ||
    settings.startWeekday > 6
  ) {
    throw new ConvexError({
      code: "INVALID_WEEKDAY",
      message: "Start weekday must be between Sunday (0) and Saturday (6).",
    })
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone }).format(0)
  } catch {
    throw new ConvexError({
      code: "INVALID_TIMEZONE",
      message: "Use a valid IANA timezone.",
    })
  }
}

export function initialSprintBounds(now: number, settings: SprintCadence) {
  validateCadence(settings)
  const context = tz(settings.timezone)
  const startsAt = startOfWeek(now, {
    weekStartsOn: settings.startWeekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    in: context,
  })
  const endsAt = addWeeks(startsAt, settings.cadenceWeeks, { in: context })
  return { startsAt: startsAt.getTime(), endsAt: endsAt.getTime() }
}

export function nextSprintBounds(startsAt: number, settings: SprintCadence) {
  validateCadence(settings)
  const context = tz(settings.timezone)
  const endsAt = addWeeks(startsAt, settings.cadenceWeeks, { in: context })
  return { startsAt, endsAt: endsAt.getTime() }
}
