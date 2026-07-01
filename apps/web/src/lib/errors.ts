import { ConvexError } from "convex/values"

/**
 * Pull a user-facing message out of a thrown error.
 * Convex mutations throw ConvexError with a `{ code, message }` payload.
 */
export function messageFromError(error: unknown, fallback: string) {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: string }
    if (data?.message) return data.message
  }
  return fallback
}
