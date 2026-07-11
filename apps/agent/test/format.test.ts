import { describe, expect, test } from "vitest"

import {
  formatActivity,
  formatCaptureTask,
  formatDailyBrief,
  formatDoctor,
  formatError,
  formatLogin,
  formatLogout,
  formatMcpInstall,
  formatProjectCreated,
  formatProjectDeleted,
  formatProjectList,
  formatProjectSummary,
  formatTaskDeleted,
  formatTaskList,
  formatTaskMoved,
  formatTaskMovedToProject,
  formatWhoami,
  loginPayload,
  logoutPayload,
  MCP_INFO,
  whoamiPayload,
} from "../src/format.js"

const convexUrl = "https://example.convex.cloud"
const workspace = { projects: 3, openTasks: 5 }
const organization = {
  organizationId: "org_1",
  slug: "acme",
  name: "Acme",
  role: "org:admin" as const,
}

describe("human formatting", () => {
  test("login greets the user and lists next commands", () => {
    const text = formatLogin({
      user: { name: "Ada", email: "ada@example.com" },
      convexUrl,
    })
    expect(text).toContain("You are now logged in as Ada <ada@example.com>.")
    expect(text).toContain(convexUrl)
    expect(text).toContain("neram whoami")
    expect(text).toContain("neram daily")
    expect(text).toContain("neram mcp")
  })

  test("login falls back to a generic label without claims", () => {
    expect(formatLogin({ user: {}, convexUrl })).toContain(
      "logged in as your account."
    )
  })

  test("whoami shows identity, counts, and MCP hints", () => {
    const text = formatWhoami({
      identity: { name: "Ada", email: "ada@example.com" },
      organization,
      convexUrl,
      workspace,
      expiresAt: Date.now() + 60 * 60 * 1000,
      hasRefreshToken: true,
    })
    expect(text).toContain("Logged in as Ada <ada@example.com>.")
    expect(text).toContain("Projects:   3")
    expect(text).toContain("Open tasks: 5")
    expect(text).toContain(MCP_INFO.hosted)
    expect(text).not.toContain("Heads up")
  })

  test("whoami warns when a non-refreshable session is near expiry", () => {
    const text = formatWhoami({
      identity: { name: "Ada" },
      organization,
      convexUrl,
      workspace,
      expiresAt: Date.now() + 60 * 1000,
      hasRefreshToken: false,
    })
    expect(text).toContain("can't refresh")
    expect(text).toContain("neram login")
  })

  test("logout reports each revocation outcome", () => {
    expect(
      formatLogout({ revocation: "succeeded", configRetained: true })
    ).toContain("Refresh token revoked.")
    expect(
      formatLogout({ revocation: "skipped", configRetained: true })
    ).toContain("revocation skipped")
    expect(
      formatLogout({ revocation: "failed", configRetained: true })
    ).toContain("revocation failed")
    expect(
      formatLogout({ revocation: "succeeded", configRetained: true })
    ).toContain("Cached workspace config kept")
  })

  test("errors are compact with an actionable hint", () => {
    const text = formatError({
      code: "UNAUTHENTICATED",
      message: "Run `neram login` first.",
    })
    expect(text).toContain("Run `neram login` first.")
    expect(text).toContain("Run `neram login` to sign in.")
    // Unknown codes fall back to just the message.
    expect(formatError({ code: "WEIRD", message: "Boom." })).toBe("Boom.")
  })
})

describe("additive JSON payloads", () => {
  test("login preserves ok/user/convexUrl and adds mcp", () => {
    const user = { name: "Ada", email: "ada@example.com" }
    expect(loginPayload(user, convexUrl)).toEqual({
      ok: true,
      user,
      convexUrl,
      mcp: MCP_INFO,
    })
  })

  test("whoami preserves ok/user/convexUrl and adds workspace + mcp", () => {
    const user = { sub: "user_1" }
    expect(whoamiPayload(user, convexUrl, workspace, organization)).toEqual({
      ok: true,
      user,
      convexUrl,
      organization,
      workspace,
      mcp: MCP_INFO,
    })
  })

  test("logout exposes configRetained and revocation", () => {
    expect(
      logoutPayload({ revocation: "failed", configRetained: true })
    ).toEqual({
      ok: true,
      configRetained: true,
      revocation: "failed",
    })
  })
})

const project = {
  projectId: "pa",
  name: "Agent",
  role: "org:admin",
  taskCount: 3,
  openTasks: 2,
  updatedAt: "2026-01-02T00:00:00.000Z",
}
const task = {
  taskId: "ta",
  projectId: "pa",
  projectName: "Agent",
  title: "Ship CLI",
  status: "inProgress",
  dueDate: "2026-02-01",
  updatedAt: "2026-01-02T00:00:00.000Z",
}

describe("workspace formatters (non-TTY plain output)", () => {
  test("daily brief renders sectioned, plain-text output", () => {
    const text = formatDailyBrief({
      projects: 4,
      assignedOpenTasks: [task],
      openTasks: [task],
      recentActivity: [
        {
          type: "task.created",
          projectName: "Agent",
          taskTitle: "Ship CLI",
          actorName: "Ada",
          createdAt: "2026-01-04T00:00:00.000Z",
        },
      ],
      suggestedNextActions: [
        { title: "Ship CLI", status: "inProgress", dueDate: "2026-02-01" },
      ],
    })
    expect(text).toContain("Daily brief")
    expect(text).toContain("Next actions")
    expect(text).toContain("Ship CLI")
    expect(text).toContain("Assigned to you")
    // Non-TTY output carries no ANSI escape codes.
    expect(text).not.toContain("\u001b[")
  })

  test("project list shows a count and one line per project", () => {
    const text = formatProjectList({ projects: [project] })
    expect(text).toContain("Projects (1)")
    expect(text).toContain("Agent")
    expect(text).toContain("2 open")
  })

  test("empty project list renders none", () => {
    expect(formatProjectList({ projects: [] })).toContain("none")
  })

  test("task list shows the project header and tasks", () => {
    const text = formatTaskList({ project, tasks: [task] })
    expect(text).toContain("Agent")
    expect(text).toContain("Ship CLI")
    expect(text).toContain("in progress")
  })

  test("project summary shows counts", () => {
    const text = formatProjectSummary({
      project,
      tasks: [task],
      counts: { todo: 1, inProgress: 1, done: 1 },
    })
    expect(text).toContain("1 todo · 1 in progress · 1 done")
  })

  test("activity feed lists actor and project", () => {
    const text = formatActivity({
      activity: [
        {
          type: "task.moved",
          projectName: "Agent",
          taskTitle: "Ship CLI",
          actorName: "Ada",
          createdAt: "2026-01-04T00:00:00.000Z",
        },
      ],
    })
    expect(text).toContain("Recent activity (1)")
    expect(text).toContain("Ada")
    expect(text).toContain("Agent")
  })

  test("mutation confirmations are concise", () => {
    expect(
      formatCaptureTask({
        taskId: "ta",
        projectName: "Agent",
        title: "Ship CLI",
      })
    ).toContain("Created")
    expect(formatTaskMoved({ taskId: "ta", status: "done" })).toContain("done")
    expect(formatTaskDeleted({ taskId: "ta" })).toContain("Deleted task")
    expect(
      formatTaskMovedToProject({ taskId: "ta", projectName: "Agent Ops" })
    ).toContain("Agent Ops")
    expect(formatProjectCreated({ projectId: "pa", name: "Agent" })).toContain(
      "Created project"
    )
    expect(formatProjectDeleted({ projectId: "pa" })).toContain(
      "Deleted project"
    )
  })

  test("doctor renders an authenticated report", () => {
    const text = formatDoctor({
      ok: true,
      config: {
        convexUrl: "https://x.convex.cloud",
        clerkFrontendApiUrl: "https://clerk.example",
        oauthClientId: "cid",
      },
      token: {
        issuer: "https://clerk.example",
        audience: "convex",
        expiresAt: "2026-01-02T00:00:00.000Z",
      },
      convex: { authenticated: true, visibleProjects: 4 },
      mcp: { stdio: MCP_INFO.stdio, hosted: MCP_INFO.hosted },
    })
    expect(text).toContain("Neram doctor")
    expect(text).toContain("Authenticated: yes")
    expect(text).toContain("Visible projects: 4")
  })

  test("doctor renders an auth failure with a hint", () => {
    const text = formatDoctor({
      ok: false,
      config: {
        convexUrl: "https://x.convex.cloud",
        clerkFrontendApiUrl: "https://clerk.example",
        oauthClientId: "cid",
      },
      auth: {
        authenticated: false,
        error: { code: "UNAUTHENTICATED", message: "Run `neram login` first." },
      },
      mcp: { stdio: MCP_INFO.stdio, hosted: MCP_INFO.hosted },
    })
    expect(text).toContain("Authenticated: no")
    expect(text).toContain("UNAUTHENTICATED")
  })
})

describe("mcp install instructions", () => {
  test("cursor uses the mcpServers config key", () => {
    const text = formatMcpInstall("cursor")
    expect(text).toContain("Cursor")
    expect(text).toContain("mcpServers")
    expect(text).toContain('"neram"')
    expect(text).toContain(MCP_INFO.hosted)
  })

  test("vscode uses the servers config key", () => {
    const text = formatMcpInstall("vscode")
    expect(text).toContain("VS Code")
    expect(text).toContain('"servers"')
  })

  test("claude-code shows the add command", () => {
    expect(formatMcpInstall("claude-code")).toContain("claude mcp add neram")
  })

  test("unknown client falls back to a generic config", () => {
    const text = formatMcpInstall("emacs")
    expect(text).toContain("Unknown client")
    expect(text).toContain("mcpServers")
  })
})
