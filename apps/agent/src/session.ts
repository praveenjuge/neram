import { AgentError } from "./errors.js"

export function claims(idToken: string) {
  const [, payload] = idToken.split(".")
  if (!payload) throw new AgentError("AUTH_FAILED", "Invalid id_token.")
  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as Record<string, unknown>
  } catch {
    throw new AgentError("AUTH_FAILED", "Invalid id_token.")
  }
}

export function requireOrganizationClaims(idToken: string) {
  const user = claims(idToken)
  if (
    typeof user.org_id !== "string" ||
    typeof user.org_slug !== "string" ||
    (user.org_role !== "org:admin" && user.org_role !== "org:member")
  ) {
    throw new AgentError(
      "ORGANIZATION_REQUIRED",
      "Choose a Neram workspace during authorization."
    )
  }
  return user as Record<string, unknown> & {
    org_id: string
    org_slug: string
    org_role: "org:admin" | "org:member"
  }
}
