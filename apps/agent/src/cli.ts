#!/usr/bin/env node
import { Command } from "commander"

import { createTools, toAgentError } from "./agent.js"
import { authClient, claims, loadPublicConfig, login, logout } from "./auth.js"
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
  formatProjectUpdated,
  formatTaskDeleted,
  formatTaskList,
  formatTaskMoved,
  formatTaskMovedToProject,
  formatTaskUpdated,
  formatWhoami,
  loginPayload,
  logoutPayload,
  MCP_INFO,
  whoamiPayload,
  type DoctorReport,
} from "./format.js"
import { runStdioMcp } from "./mcp.js"
import { packageVersion } from "./version.js"

type OutputOptions = { json?: boolean }

// Emit polished human text by default and stable, machine-readable JSON when
// `--json` is passed. Human is the quiet default; JSON stays additive and keeps
// the exact tool payload so scripts and agents can rely on the shape.
function emit(opts: OutputOptions, human: string, json: unknown) {
  console.log(opts.json ? JSON.stringify(json, null, 2) : human)
}

function wrap(opts: OutputOptions, fn: () => Promise<void>) {
  fn().catch((error) => {
    const err = toAgentError(error)
    if (opts.json) {
      console.error(JSON.stringify({ ok: false, error: { code: err.code, message: err.message, details: err.details } }))
    } else {
      console.error(formatError(err))
    }
    process.exitCode = 1
  })
}

async function tools() {
  const { client } = await authClient()
  return createTools(client)
}

function projectRef(opts: { project?: string; projectId?: string }) {
  return { project: opts.project, projectId: opts.projectId }
}

// Address a task by id, or by project + title (matching the tool's task ref).
function taskRef(opts: { taskId?: string; project?: string; projectId?: string; title?: string }) {
  return { taskId: opts.taskId, project: opts.project, projectId: opts.projectId, taskTitle: opts.title }
}

const toInt = (value: string) => Number.parseInt(value, 10)

const program = new Command()
program.name("neram").description("Neram workspace CLI for AI agents").version(packageVersion())

program.command("login")
  .description("Sign in with Clerk OAuth and store credentials locally")
  .option("--convex-url <url>")
  .option("--clerk-frontend-api-url <url>")
  .option("--oauth-client-id <id>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    // Login never makes live workspace calls; it only completes OAuth and
    // reports the local identity + config target.
    const { user, config } = await login({
      convexUrl: opts.convexUrl,
      clerkFrontendApiUrl: opts.clerkFrontendApiUrl,
      oauthClientId: opts.oauthClientId,
    })
    emit(opts, formatLogin({ user, convexUrl: config.convexUrl }), loginPayload(user, config.convexUrl))
  }))

program.command("logout")
  .description("Clear local credentials and revoke the refresh token")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await logout()
    emit(opts, formatLogout(result), logoutPayload(result))
  }))

program.command("whoami")
  .description("Show your identity and workspace totals")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const { session, client } = await authClient()
    const status = await client.status()
    const user = claims(session.idToken)
    emit(
      opts,
      formatWhoami({
        identity: status.identity,
        convexUrl: session.config.convexUrl,
        workspace: status.workspace,
        expiresAt: session.expiresAt,
        hasRefreshToken: Boolean(session.refreshToken),
      }),
      whoamiPayload(user, session.config.convexUrl, status.workspace)
    )
  }))

program.command("doctor")
  .description("Diagnose config, auth, and MCP readiness")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const config = await loadPublicConfig()
    const mcp = { stdio: MCP_INFO.stdio, hosted: MCP_INFO.hosted }
    try {
      const { session, client } = await authClient()
      const projects = await client.projects()
      const report: DoctorReport = {
        ok: true,
        config,
        token: {
          issuer: claims(session.idToken).iss,
          audience: claims(session.idToken).aud,
          expiresAt: new Date(session.expiresAt).toISOString(),
        },
        convex: { authenticated: true, visibleProjects: projects.length },
        mcp,
      }
      emit(opts, formatDoctor(report), report)
    } catch (error) {
      const err = toAgentError(error)
      const report: DoctorReport = {
        ok: false,
        config,
        auth: {
          authenticated: false,
          error: { code: err.code, message: err.message, details: err.details },
        },
        mcp,
      }
      emit(opts, formatDoctor(report), report)
      process.exitCode = 1
    }
  }))

const mcp = program.command("mcp").description("Start the local stdio MCP server")
mcp.action(() => wrap({}, async () => {
  // Fail fast with a friendly message when unauthenticated. Never auto-login
  // from MCP startup, and never emit JSON errors onto the stdio protocol stream.
  let client
  try {
    ({ client } = await authClient())
  } catch (error) {
    const err = toAgentError(error)
    if (err.code === "UNAUTHENTICATED") {
      process.stderr.write("Not logged in. Run `neram login`, then `neram mcp`.\n")
      process.exitCode = 1
      return
    }
    throw error
  }
  await runStdioMcp(client)
}))
mcp.command("install [client]")
  .description("Print setup instructions for an MCP client (claude-code, cursor, vscode)")
  .action((client?: string) => {
    // Print-only: never writes to any client config file.
    console.log(formatMcpInstall(client))
  })

program.command("daily").alias("brief")
  .description("Show a compact daily execution digest")
  .option("--project-limit <n>", "Projects to scan for open work (1-20).", toInt)
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const brief = await (await tools()).daily_brief({ projectLimit: opts.projectLimit })
    emit(opts, formatDailyBrief(brief), brief)
  }))

program.command("activity")
  .description("Show your recent activity feed")
  .option("--limit <n>", "Items to return (1-50).", toInt)
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await (await tools()).recent_activity({ limit: opts.limit })
    emit(opts, formatActivity(result), result)
  }))

const task = program.command("task").description("Create and manage tasks")
task.command("add")
  .description("Create a task in a project")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .requiredOption("-t, --title <title>")
  .option("-d, --description <description>")
  .option("--due <yyyy-mm-dd>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await (await tools()).capture_task({
      ...projectRef(opts),
      title: opts.title,
      description: opts.description,
      dueDate: opts.due,
    })
    emit(opts, formatCaptureTask(result), result)
  }))
task.command("list")
  .description("List a project's tasks, optionally filtered by status")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("--status <todo|inProgress|done>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await (await tools()).list_tasks({ ...projectRef(opts), status: opts.status })
    emit(opts, formatTaskList(result), result)
  }))
task.command("move")
  .description("Move or reorder a task by status")
  .requiredOption("--status <todo|inProgress|done>")
  .option("--task-id <id>")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("-t, --title <title>")
  .option("--position <number>", "Fractional board position.", Number.parseFloat)
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await (await tools()).move_task({
      ...taskRef(opts),
      status: opts.status,
      position: opts.position,
    })
    emit(opts, formatTaskMoved(result), result)
  }))
task.command("done")
  .description("Mark a task done")
  .option("--task-id <id>")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("-t, --title <title>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await (await tools()).complete_task(taskRef(opts))
    emit(opts, formatTaskMoved(result), result)
  }))
task.command("update")
  .description("Update a task's title, description, or due date, or clear its assignee")
  .option("--task-id <id>")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("--task-title <title>", "Address the task by title within the project.")
  .option("--title <title>", "New title.")
  .option("-d, --description <description>", "New description.")
  .option("--due <yyyy-mm-dd>", "New due date.")
  .option("--clear-assignee", "Remove the current assignee.")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await (await tools()).update_task({
      taskId: opts.taskId,
      ...projectRef(opts),
      taskTitle: opts.taskTitle,
      title: opts.title,
      description: opts.description,
      dueDate: opts.due,
      clearAssignee: opts.clearAssignee,
    })
    emit(opts, formatTaskUpdated(result), result)
  }))
task.command("rm")
  .description("Delete a task")
  .option("--task-id <id>")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("-t, --title <title>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await (await tools()).delete_task(taskRef(opts))
    emit(opts, formatTaskDeleted(result), result)
  }))
task.command("move-to")
  .description("Move a task to another project")
  .option("--task-id <id>")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("-t, --title <title>")
  .option("--to-project <name>")
  .option("--to-project-id <id>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await (await tools()).move_task_to_project({
      ...taskRef(opts),
      toProject: opts.toProject,
      toProjectId: opts.toProjectId,
    })
    emit(opts, formatTaskMovedToProject(result), result)
  }))

const project = program.command("project").description("Create and manage projects")
project.command("list")
  .description("List every project you can see")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await (await tools()).list_projects({})
    emit(opts, formatProjectList(result), result)
  }))
project.command("add")
  .description("Create a new project")
  .requiredOption("--name <name>")
  .option("--icon <icon>")
  .option("--color <color>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await (await tools()).create_project({ name: opts.name, icon: opts.icon, color: opts.color })
    emit(opts, formatProjectCreated(result), result)
  }))
project.command("update")
  .description("Update a project's name, icon, or color")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("--name <name>")
  .option("--icon <icon>")
  .option("--color <color>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await (await tools()).update_project({
      ...projectRef(opts),
      name: opts.name,
      icon: opts.icon,
      color: opts.color,
    })
    emit(opts, formatProjectUpdated(result), result)
  }))
project.command("rm")
  .description("Delete a project and all of its tasks")
  .requiredOption("--project-id <id>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await (await tools()).delete_project({ projectId: opts.projectId })
    emit(opts, formatProjectDeleted(result), result)
  }))
project.command("summary")
  .description("Show a project's tasks and status counts")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    const result = await (await tools()).summarize_project({ ...projectRef(opts) })
    emit(opts, formatProjectSummary(result), result)
  }))

program.parse()
