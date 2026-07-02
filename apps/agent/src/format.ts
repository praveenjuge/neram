import type { WorkspaceStatus } from "./agent.js"

/** How to reach the MCP server, surfaced in both human and JSON output. */
export const MCP_INFO = {
  stdio: "neram mcp",
  hosted: "https://neram.praveenjuge.com/mcp",
} as const

/** Result of the best-effort refresh-token revocation performed on logout. */
export type RevocationResult = "succeeded" | "skipped" | "failed"

/** Minimal claims shape read from the id_token for display purposes. */
type Claims = Record<string, unknown>

// Small, dependency-free TTY styling. When stdout is not a terminal (pipes,
// CI, tests) these become no-ops, so machine-readable and test output stays
// clean and deterministic.
function useColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
}

function bold(text: string) {
  return useColor() ? `\u001b[1m${text}\u001b[22m` : text
}

function dim(text: string) {
  return useColor() ? `\u001b[2m${text}\u001b[22m` : text
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

/** "Name <email>", falling back to whichever field exists, then a generic label. */
export function identityLabel(name?: string, email?: string) {
  if (name && email) return `${name} <${email}>`
  return name ?? email ?? "your account"
}

function claimsLabel(user: Claims) {
  return identityLabel(asString(user.name), asString(user.email))
}

/** Quiet, friendly confirmation after a successful login. No workspace calls. */
export function formatLogin(input: { user: Claims; convexUrl: string }) {
  return [
    `You are now logged in as ${bold(claimsLabel(input.user))}.`,
    "",
    dim(`Workspace: ${input.convexUrl}`),
    "",
    "Next:",
    `  ${bold("neram whoami")}  Check your workspace status`,
    `  ${bold("neram daily")}   Get your daily brief`,
    `  ${bold("neram mcp")}     Start the MCP server for your agent`,
  ].join("\n")
}

// Warn about expiry only when the session is actually near its end. authClient
// refreshes ahead of time when a refresh token exists, so a near-expiry session
// here effectively means refresh is unavailable or already failed.
const EXPIRY_WARNING_WINDOW_MS = 10 * 60 * 1000

/** Human workspace snapshot for `whoami`: identity, totals, target, MCP hints. */
export function formatWhoami(input: {
  identity: WorkspaceStatus["identity"]
  convexUrl: string
  workspace: WorkspaceStatus["workspace"]
  expiresAt: number
  hasRefreshToken: boolean
}) {
  const w = input.workspace
  const lines = [
    `Logged in as ${bold(identityLabel(input.identity.name, input.identity.email))}.`,
    "",
    `Projects:   ${w.projects} (${w.ownedProjects} owned, ${w.sharedProjects} shared)`,
    `Open tasks: ${w.openTasks}`,
    "",
    dim(`Workspace: ${input.convexUrl}`),
    "",
    "MCP:",
    `  stdio    ${MCP_INFO.stdio}`,
    `  hosted   ${MCP_INFO.hosted}`,
  ]
  if (input.expiresAt - Date.now() < EXPIRY_WARNING_WINDOW_MS) {
    lines.push("")
    lines.push(
      input.hasRefreshToken
        ? "Heads up: your session expires soon."
        : "Heads up: your session expires soon and can't refresh. Run `neram login` to renew."
    )
  }
  return lines.join("\n")
}

const REVOCATION_LINE: Record<RevocationResult, string> = {
  succeeded: "Refresh token revoked.",
  skipped: "Token revocation skipped (nothing to revoke).",
  failed: "Token revocation failed, but local credentials were still cleared.",
}

/** Human confirmation for `logout`, reporting the revocation outcome. */
export function formatLogout(input: {
  revocation: RevocationResult
  configRetained: boolean
}) {
  const lines = [
    "You are now logged out. Local credentials cleared.",
    REVOCATION_LINE[input.revocation],
  ]
  if (input.configRetained) {
    lines.push(dim("Cached workspace config kept for your next login."))
  }
  return lines.join("\n")
}

// Short, actionable next-step hints keyed by the stable error code. Kept out of
// JSON mode, where the raw code is what callers switch on.
const ERROR_HINTS: Record<string, string> = {
  UNAUTHENTICATED: "Run `neram login` to sign in.",
  MISSING_CONFIG: "Check your Neram config, or set NERAM_CONVEX_URL.",
  AUTH_FAILED: "Run `neram login` again to re-authenticate.",
  AMBIGUOUS: "Use --project-id or --task-id to pick exactly one.",
  NOT_FOUND: "Double-check the project or task name and try again.",
  FORBIDDEN: "You don't have access to do that.",
  VALIDATION: "Check the command arguments and try again.",
}

/** Compact, human-friendly error: what failed plus a likely next command. */
export function formatError(err: { code: string; message: string }) {
  const hint = ERROR_HINTS[err.code]
  return hint ? `${err.message}\n${hint}` : err.message
}

/** Additive, backward-compatible JSON payload for `login`. */
export function loginPayload(user: Claims, convexUrl: string) {
  return { ok: true as const, user, convexUrl, mcp: MCP_INFO }
}

/** Additive, backward-compatible JSON payload for `whoami`. */
export function whoamiPayload(
  user: Claims,
  convexUrl: string,
  workspace: WorkspaceStatus["workspace"]
) {
  return { ok: true as const, user, convexUrl, workspace, mcp: MCP_INFO }
}

/** Additive JSON payload for `logout`. */
export function logoutPayload(input: {
  revocation: RevocationResult
  configRetained: boolean
}) {
  return {
    ok: true as const,
    configRetained: input.configRetained,
    revocation: input.revocation,
  }
}
