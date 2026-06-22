import { format, parse } from "date-fns"

// Tasks store their due date as a plain `yyyy-MM-dd` string (what the Convex
// validator expects), so we convert to/from a Date only at the picker edge.
export const DUE_DATE_FORMAT = "yyyy-MM-dd"

/** Parse a stored `yyyy-MM-dd` value into a local Date, or undefined if unset/invalid. */
export function parseDueDate(value: string | undefined) {
  if (!value) return undefined
  const parsed = parse(value, DUE_DATE_FORMAT, new Date())
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

/** Render a stored due date for display, falling back to the raw value. */
export function formatDueDate(value: string | undefined) {
  const date = parseDueDate(value)
  return date ? format(date, "MMM d, yyyy") : (value ?? "")
}
