import { ConvexError } from "convex/values"
import * as z from "zod/v3"

export class AgentError extends Error {
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.code = code
    this.details = details
  }
}

export function toAgentError(error: unknown) {
  if (error instanceof AgentError) return error
  if (error instanceof z.ZodError) {
    return new AgentError(
      "VALIDATION",
      error.issues[0]?.message ?? "Invalid input.",
      { issues: error.issues }
    )
  }
  if (
    error instanceof ConvexError ||
    (typeof error === "object" &&
      error !== null &&
      "data" in error &&
      typeof error.data === "object")
  ) {
    const data = (error as { data?: unknown }).data
    if (
      typeof data === "object" &&
      data &&
      "code" in data &&
      "message" in data
    ) {
      const { code, message, ...details } = data as Record<string, unknown>
      return new AgentError(
        String(code),
        String(message),
        Object.keys(details).length > 0 ? details : undefined
      )
    }
  }
  const message = error instanceof Error ? error.message : "Unexpected error."
  return new AgentError("INTERNAL", message)
}
