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
  organization: WorkspaceStatus["organization"]
  convexUrl: string
  workspace: WorkspaceStatus["workspace"]
  expiresAt: number
  hasRefreshToken: boolean
}) {
  const w = input.workspace
  const lines = [
    `Logged in as ${bold(identityLabel(input.identity.name, input.identity.email))}.`,
    "",
    `Workspace:  ${input.organization.name} (${input.organization.slug})`,
    `Role:       ${input.organization.role}`,
    "",
    `Projects:   ${w.projects} (${w.ownedProjects} owned, ${w.sharedProjects} shared)`,
    `Open tasks: ${w.openTasks}`,
    "",
    dim(`Convex: ${input.convexUrl}`),
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

// --- Workspace formatters -------------------------------------------------
// Human-friendly renderings of the tool payloads. `--json` still emits the
// exact tool output; these are the quiet default for interactive use. All rely
// on the no-op color helpers above, so piped/CI output stays plain text.

const STATUS_LABEL: Record<string, string> = {
  todo: "todo",
  inProgress: "in progress",
  done: "done",
}

function statusLabel(status?: string) {
  return status ? STATUS_LABEL[status] ?? status : ""
}

/** Date portion (YYYY-MM-DD) of an ISO timestamp, for compact display. */
function shortDate(value?: string) {
  return value ? value.slice(0, 10) : undefined
}

// A titled block: bold heading, indented body lines, or a dim "none" when empty.
function section(title: string, lines: string[]) {
  if (lines.length === 0) return `${bold(title)}\n  ${dim("none")}`
  return [bold(title), ...lines].join("\n")
}

function bullet(text: string) {
  return `  • ${text}`
}

function taskBullet(task: CompactTaskLike) {
  const meta: string[] = []
  const label = statusLabel(task.status)
  if (label) meta.push(label)
  if (task.dueDate) meta.push(`due ${task.dueDate}`)
  if (task.assigneeName) meta.push(task.assigneeName)
  if (task.totalSubtasks) {
    meta.push(`${task.completedSubtasks ?? 0}/${task.totalSubtasks} subtasks`)
  }
  if (task.activeCommentCount) meta.push(`${task.activeCommentCount} comments`)
  const project = task.projectName ? ` ${dim(`— ${task.projectName}`)}` : ""
  const tail = meta.length ? ` ${dim(`(${meta.join(", ")})`)}` : ""
  return bullet(`${task.title}${project}${tail}`)
}

function projectBullet(project: CompactProjectLike) {
  const bits = [`${project.openTasks} open`, `${project.taskCount} total`, project.role]
  return bullet(`${project.name} ${dim(`(${bits.join(", ")})`)}`)
}

function activityBullet(item: CompactActivityLike) {
  const parts = [item.actorName, item.type.replace(/[._]/g, " ")]
  if (item.taskTitle) parts.push(`"${item.taskTitle}"`)
  parts.push(`in ${item.projectName}`)
  const when = shortDate(item.createdAt)
  const tail = when ? ` ${dim(`(${when})`)}` : ""
  return bullet(`${parts.join(" · ")}${tail}`)
}

// Structural shapes so this module doesn't depend on the exact zod inference.
type CompactProjectLike = {
  projectId: string
  name: string
  role: string
  taskCount: number
  openTasks: number
  updatedAt?: string
}
type CompactTaskLike = {
  taskId: string
  projectId: string
  projectName?: string
  title: string
  description?: string
  status: string
  dueDate?: string
  assigneeName?: string
  totalSubtasks?: number
  completedSubtasks?: number
  activeCommentCount?: number
  updatedAt?: string
}
type CompactActivityLike = {
  type: string
  projectName: string
  taskTitle?: string
  toStatus?: string
  actorName: string
  createdAt?: string
}

/** The `daily_brief` digest as a scannable, sectioned overview. */
export function formatDailyBrief(brief: {
  projects: number
  assignedOpenTasks: CompactTaskLike[]
  openTasks: CompactTaskLike[]
  recentActivity: CompactActivityLike[]
  suggestedNextActions: Array<{ title: string; status: string; dueDate?: string }>
}) {
  return [
    bold("Daily brief"),
    dim(`${brief.projects} projects · ${brief.assignedOpenTasks.length} assigned · ${brief.openTasks.length} open tracked`),
    "",
    section("Next actions", brief.suggestedNextActions.map((a) => {
      const meta: string[] = [statusLabel(a.status)]
      if (a.dueDate) meta.push(`due ${a.dueDate}`)
      return bullet(`${a.title} ${dim(`(${meta.filter(Boolean).join(", ")})`)}`)
    })),
    "",
    section("Assigned to you", brief.assignedOpenTasks.map(taskBullet)),
    "",
    section("Recent activity", brief.recentActivity.map(activityBullet)),
  ].join("\n")
}

/** The `list_projects` result as a one-line-per-project list. */
export function formatProjectList(result: { projects: CompactProjectLike[] }) {
  return section(`Projects (${result.projects.length})`, result.projects.map(projectBullet))
}

/** The `list_tasks` result: a project header plus one line per task. */
export function formatTaskList(result: { project: CompactProjectLike; tasks: CompactTaskLike[] }) {
  return [
    bold(result.project.name),
    dim(`${result.tasks.length} task(s)`),
    "",
    section("Tasks", result.tasks.map(taskBullet)),
  ].join("\n")
}

export function formatTaskDetail(task: CompactTaskLike) {
  const lines = [taskBullet(task), dim(`  Task ${task.taskId}`)]
  if (task.description) lines.push(`  ${task.description}`)
  return lines.join("\n")
}

export function formatProjectMembers(result: {
  members: Array<{
    subject: string
    displayName: string
    role: string
    isYou?: boolean
  }>
}) {
  return section(
    `Members (${result.members.length})`,
    result.members.map((member) =>
      bullet(
        `${member.displayName}${member.isYou ? " (you)" : ""} ${dim(`(${member.role}) ${member.subject}`)}`
      )
    )
  )
}

type CompactSubtaskLike = {
  subtaskId: string
  title: string
  completed: boolean
  position: number
}

export function formatSubtasks(result: { subtasks: CompactSubtaskLike[] }) {
  return section(
    `Subtasks (${result.subtasks.length})`,
    result.subtasks.map((item) =>
      bullet(`${item.completed ? "[x]" : "[ ]"} ${item.title} ${dim(item.subtaskId)}`)
    )
  )
}

type CompactCommentLike = {
  commentId: string
  parentCommentId?: string
  authorName: string
  body: string
  tombstone: boolean
  edited: boolean
}

export function formatComments(result: {
  parentCommentId?: string
  comments: CompactCommentLike[]
  cursor: string | null
}) {
  const level = result.parentCommentId ? "Direct replies" : "Root comments"
  const lines = result.comments.map((item) => {
    const flags = [item.tombstone ? "deleted" : "", item.edited ? "edited" : ""]
      .filter(Boolean)
      .join(", ")
    return bullet(
      `${item.authorName}: ${item.body}${flags ? ` ${dim(`(${flags})`)}` : ""}\n    ${dim(item.commentId)}`
    )
  })
  if (result.cursor) lines.push(`  ${dim(`Next cursor: ${result.cursor}`)}`)
  return section(`${level} (${result.comments.length})`, lines)
}

export function formatCreated(label: string, id: string) {
  return `${label}.\n${dim(id)}`
}

/** The `summarize_project` result: project header, counts, and task list. */
export function formatProjectSummary(result: {
  project: CompactProjectLike
  tasks: CompactTaskLike[]
  counts: { todo: number; inProgress: number; done: number }
}) {
  const c = result.counts
  return [
    bold(result.project.name),
    dim(`${c.todo} todo · ${c.inProgress} in progress · ${c.done} done`),
    "",
    section("Tasks", result.tasks.map(taskBullet)),
  ].join("\n")
}

/** The `recent_activity` result as a newest-first feed. */
export function formatActivity(result: { activity: CompactActivityLike[] }) {
  return section(`Recent activity (${result.activity.length})`, result.activity.map(activityBullet))
}

/** Confirmation after `capture_task`. */
export function formatCaptureTask(result: { taskId: string; projectName: string; title: string }) {
  return `Created ${bold(`"${result.title}"`)} in ${result.projectName}.\n${dim(`Task ${result.taskId}`)}`
}

/** Confirmation after `move_task` / `complete_task`. */
export function formatTaskMoved(result: { taskId: string; status: string }) {
  return `Moved task to ${bold(statusLabel(result.status))}.\n${dim(`Task ${result.taskId}`)}`
}

/** Confirmation after `update_task`. */
export function formatTaskUpdated(result: { taskId: string }) {
  return `Updated task.\n${dim(`Task ${result.taskId}`)}`
}

/** Confirmation after `delete_task`. */
export function formatTaskDeleted(result: {
  taskId: string
  subtaskCount?: number
  commentCount?: number
}) {
  const children = (result.subtaskCount ?? 0) + (result.commentCount ?? 0)
  return `Deleted task${children ? ` and ${children} child item(s)` : ""}.\n${dim(`Task ${result.taskId}`)}`
}

/** Confirmation after `move_task_to_project`. */
export function formatTaskMovedToProject(result: { taskId: string; projectName: string }) {
  return `Moved task to ${bold(result.projectName)}.\n${dim(`Task ${result.taskId}`)}`
}

/** Confirmation after `create_project`. */
export function formatProjectCreated(result: { projectId: string; name: string }) {
  return `Created project ${bold(`"${result.name}"`)}.\n${dim(result.projectId)}`
}

/** Confirmation after `update_project`. */
export function formatProjectUpdated(result: { projectId: string }) {
  return `Updated project.\n${dim(result.projectId)}`
}

/** Confirmation after `delete_project`. */
export function formatProjectDeleted(result: { projectId: string }) {
  return `Deleted project and all of its tasks.\n${dim(result.projectId)}`
}

/** Doctor report shared with the CLI so `--json` keeps its exact payload. */
export type DoctorReport =
  | {
      ok: true
      config: { convexUrl: string; clerkFrontendApiUrl: string; oauthClientId: string }
      token: { issuer: unknown; audience: unknown; expiresAt: string }
      convex: { authenticated: boolean; visibleProjects: number }
      mcp: { stdio: string; hosted: string }
    }
  | {
      ok: false
      config: { convexUrl: string; clerkFrontendApiUrl: string; oauthClientId: string }
      auth: { authenticated: false; error: { code: string; message: string; details?: Record<string, unknown> } }
      mcp: { stdio: string; hosted: string }
    }

/** Human diagnostics for `doctor`: config target, auth state, and MCP hints. */
export function formatDoctor(report: DoctorReport) {
  const lines = [
    bold("Neram doctor"),
    "",
    bold("Config"),
    `  Convex:  ${report.config.convexUrl}`,
    `  Clerk:   ${report.config.clerkFrontendApiUrl}`,
    "",
  ]
  if (report.ok) {
    lines.push(
      bold("Auth"),
      "  Authenticated: yes",
      `  Issuer:   ${String(report.token.issuer)}`,
      `  Expires:  ${report.token.expiresAt}`,
      `  Visible projects: ${report.convex.visibleProjects}`,
    )
  } else {
    lines.push(
      bold("Auth"),
      "  Authenticated: no",
      `  ${report.auth.error.code}: ${report.auth.error.message}`,
    )
    const hint = ERROR_HINTS[report.auth.error.code]
    if (hint) lines.push(`  ${dim(hint)}`)
  }
  lines.push("", bold("MCP"), `  stdio    ${report.mcp.stdio}`, `  hosted   ${report.mcp.hosted}`)
  return lines.join("\n")
}

// --- MCP install ----------------------------------------------------------
// The command and config snippets are static; `mcp install` only prints them.
const MCP_COMMAND = { command: "npx", args: ["neram", "mcp"] } as const

function serverSnippet(key: "mcpServers" | "servers") {
  return JSON.stringify({ [key]: { neram: MCP_COMMAND } }, null, 2)
}

/** Per-client setup instructions for wiring up the local stdio MCP server. */
export function formatMcpInstall(client?: string) {
  const target = (client ?? "generic").toLowerCase()
  const footer = [
    "",
    dim(`Sign in first: ${MCP_INFO.stdio.replace("mcp", "login")} then ${MCP_INFO.stdio}`),
    dim(`Hosted endpoint (Streamable HTTP): ${MCP_INFO.hosted}`),
  ]
  const blocks: Record<string, string[]> = {
    "claude-code": [
      bold("Claude Code"),
      "Register the server in one step:",
      "  claude mcp add neram -- npx neram mcp",
      "",
      "Or add it to your MCP config manually:",
      serverSnippet("mcpServers"),
    ],
    cursor: [
      bold("Cursor"),
      "Add to ~/.cursor/mcp.json (global) or .cursor/mcp.json (project):",
      serverSnippet("mcpServers"),
    ],
    vscode: [
      bold("VS Code"),
      "Add to .vscode/mcp.json:",
      serverSnippet("servers"),
    ],
    generic: [
      bold("MCP client"),
      "Add this server to your client's MCP configuration:",
      serverSnippet("mcpServers"),
    ],
  }
  const block = blocks[target] ?? [
    dim(`Unknown client "${target}". Showing a generic config.`),
    "",
    ...blocks.generic,
  ]
  return [...block, ...footer].join("\n")
}

/** Additive, backward-compatible JSON payload for `login`. */
export function loginPayload(user: Claims, convexUrl: string) {
  return { ok: true as const, user, convexUrl, mcp: MCP_INFO }
}

/** Additive, backward-compatible JSON payload for `whoami`. */
export function whoamiPayload(
  user: Claims,
  convexUrl: string,
  workspace: WorkspaceStatus["workspace"],
  organization: WorkspaceStatus["organization"]
) {
  return {
    ok: true as const,
    user,
    convexUrl,
    organization,
    workspace,
    mcp: MCP_INFO,
  }
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
