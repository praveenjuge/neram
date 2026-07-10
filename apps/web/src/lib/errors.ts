import { ConvexError } from "convex/values"

/**
 * Pull a user-facing message out of a thrown error.
 * Convex mutations throw ConvexError with a `{ code, message }` payload.
 */
export function messageFromError(error: unknown, fallback: string) {
  if (
    error instanceof ConvexError ||
    (typeof error === "object" && error !== null && "data" in error)
  ) {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  return fallback
}

export function dataFromError(error: unknown): Record<string, unknown> | null {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return null
  }
  const data = (error as { data?: unknown }).data
  return typeof data === "object" && data
    ? (data as Record<string, unknown>)
    : null
}
