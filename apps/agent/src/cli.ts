#!/usr/bin/env node
import { Command } from "commander"

import { createTools, parseInlineMentions, toAgentError } from "./agent.js"
import {
  authClient,
  authClientSession,
  claims,
  loadPublicConfig,
  login,
  logout,
} from "./auth.js"
import { AgentError } from "./errors.js"
import {
  formatActivity,
  formatCaptureTask,
  formatComments,
  formatCreated,
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
  formatTaskDetail,
  formatTaskList,
  formatTaskMoved,
  formatTaskMovedToProject,
  formatTaskUpdated,
  formatSubtasks,
  formatWhoami,
  loginPayload,
  logoutPayload,
  MCP_INFO,
  whoamiPayload,
  type DoctorReport,
} from "./format.js"
import { runStdioMcp } from "./mcp.js"
import { registerPlanningCommands } from "./cli-planning.js"
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
      console.error(
        JSON.stringify({
          ok: false,
          error: { code: err.code, message: err.message, details: err.details },
        })
      )
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
function taskRef(opts: {
  taskId?: string
  project?: string
  projectId?: string
  title?: string
}) {
  return {
    taskId: opts.taskId,
    project: opts.project,
    projectId: opts.projectId,
    taskTitle: opts.title,
  }
}

const toInt = (value: string) => Number.parseInt(value, 10)

const program = new Command()
program
  .name("neram")
  .description("Neram workspace CLI for AI agents")
  .version(packageVersion())

program
  .command("login")
  .description("Sign in with Clerk OAuth and store credentials locally")
  .option("--convex-url <url>")
  .option("--clerk-frontend-api-url <url>")
  .option("--oauth-client-id <id>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      // Login never makes live workspace calls; it only completes OAuth and
      // reports the local identity + config target.
      const { user, config } = await login({
        convexUrl: opts.convexUrl,
        clerkFrontendApiUrl: opts.clerkFrontendApiUrl,
        oauthClientId: opts.oauthClientId,
      })
      emit(
        opts,
        formatLogin({ user, convexUrl: config.convexUrl }),
        loginPayload(user, config.convexUrl)
      )
    })
  )

program
  .command("logout")
  .description("Clear local credentials and revoke the refresh token")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await logout()
      emit(opts, formatLogout(result), logoutPayload(result))
    })
  )

program
  .command("whoami")
  .description("Show your identity and workspace totals")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const { session, client } = await authClient()
      const status = await client.status()
      const user = claims(session.idToken)
      emit(
        opts,
        formatWhoami({
          identity: status.identity,
          organization: status.organization,
          convexUrl: session.config.convexUrl,
          workspace: status.workspace,
          expiresAt: session.expiresAt,
          hasRefreshToken: Boolean(session.refreshToken),
        }),
        whoamiPayload(
          user,
          session.config.convexUrl,
          status.workspace,
          status.organization
        )
      )
    })
  )

program
  .command("doctor")
  .description("Diagnose config, auth, and MCP readiness")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
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
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
            },
          },
          mcp,
        }
        emit(opts, formatDoctor(report), report)
        process.exitCode = 1
      }
    })
  )

const mcp = program
  .command("mcp")
  .description("Start the local stdio MCP server")
mcp.action(() =>
  wrap({}, async () => {
    // Defer auth to tool-call time. Starting the stdio server must never exit
    // or fail the handshake over a missing session, an expired token, or an
    // unreachable token endpoint — MCP clients treat a closed connection as
    // "server down" and park it. Instead we serve a healthy JSON-RPC peer and
    // let the first real tool call surface UNAUTHENTICATED as an isError
    // result (see runStdioMcp).
    const config = await loadPublicConfig()
    const session = await authClientSession()
    // A session's id token is bound to the deployment it was issued for. Always
    // target that deployment for authenticated calls, even if an environment
    // override (NERAM_CONVEX_URL) points elsewhere — sending a session JWT to a
    // different Convex deployment would leak credentials to the wrong target.
    const convexUrl = session.convexUrl ?? config.convexUrl
    if (session.session && config.convexUrl !== convexUrl) {
      process.stderr.write(
        `neram mcp: warning - the configured Convex target (${config.convexUrl}) differs from the deployment this session is bound to (${convexUrl}); using the session target for authenticated calls.\n`
      )
    }
    const getToken =
      session.getToken ??
      (async () => {
        throw new AgentError("UNAUTHENTICATED", "Run `neram login` first.")
      })
    await runStdioMcp(convexUrl, getToken)
  })
)
mcp
  .command("install [client]")
  .description(
    "Print setup instructions for an MCP client (claude-code, cursor, vscode, opencode, goose)"
  )
  .option("--write", "Write the snippet into the client config file")
  .option("--merge", "Merge with existing config instead of overwriting")
  .option("--json")
  .action((client?: string, opts?: { write?: boolean; merge?: boolean; json?: boolean }) =>
    wrap(opts ?? {}, async () => {
      const { writeMcpInstall } = await import("./mcp-install.js")
      if (opts?.write) {
        const result = await writeMcpInstall(client, { merge: opts.merge })
        emit(opts ?? {}, result.human, result.json)
        return
      }
      // Print-only by default: never writes to any client config file.
      const text = formatMcpInstall(client)
      if (opts?.json) console.log(JSON.stringify({ ok: true, client: client ?? "generic", instructions: text }, null, 2))
      else console.log(text)
    })
  )

mcp
  .command("serve")
  .description("Serve Streamable HTTP locally (for Inspector testing)")
  .option("--port <n>", "Port to listen on.", "3030")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const { createServer } = await import("node:http")
      const config = await loadPublicConfig()
      const session = await authClientSession()
      const convexUrl = session.convexUrl ?? config.convexUrl
      const { createConvexApi } = await import("./agent.js")
      const { handleHttpMcp } = await import("./mcp.js")
      const getToken =
        session.getToken ??
        (async () => {
          throw new AgentError("UNAUTHENTICATED", "Run `neram login` first.")
        })
      const client = createConvexApi(convexUrl, getToken)
      const port = Number.parseInt(opts.port, 10)
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new AgentError("VALIDATION", "Port must be 1-65535.")
      }
      // Cap request bodies so a peer cannot exhaust the CLI process memory.
      const MAX_BODY_BYTES = 1_000_000
      const server = createServer((req, res) => {
        let bytes = 0
        let raw = ""
        let rejected = false
        req.on("data", (chunk: Buffer) => {
          if (rejected) return
          bytes += chunk.length
          if (bytes > MAX_BODY_BYTES) {
            rejected = true
            res.writeHead(413, { "content-type": "application/json" })
            res.end(
              JSON.stringify({
                error: {
                  code: "PAYLOAD_TOO_LARGE",
                  message: `Request body exceeds ${MAX_BODY_BYTES} bytes.`,
                },
              })
            )
            req.destroy()
            return
          }
          raw += chunk
        })
        req.on("end", () => {
          if (rejected) return
          try {
            ;(req as { body?: unknown }).body = raw ? JSON.parse(raw) : undefined
          } catch {
            ;(req as { body?: unknown }).body = undefined
          }
          void handleHttpMcp(req as never, res as never, client)
        })
      })
      // Bind loopback only: this server carries the user's session-backed
      // client, so it must never accept non-loopback peers.
      await new Promise<void>((resolve) =>
        server.listen(port, "127.0.0.1", resolve)
      )
      const url = `http://127.0.0.1:${port}/mcp`
      emit(
        opts,
        `Neram MCP Streamable HTTP listening on ${url}\nTest: npx @modelcontextprotocol/inspector --cli ${url} --transport http --method tools/list`,
        { ok: true, url, transport: "streamable-http", stateless: true }
      )
    })
  )

mcp
  .command("list")
  .description("List MCP tools, resources, and prompts (no client needed)")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const { Client } = await import("@modelcontextprotocol/client")
      const { InMemoryTransport } = await import("@modelcontextprotocol/server")
      const { createNeramMcpServer } = await import("./mcp.js")
      const config = await loadPublicConfig()
      const session = await authClientSession()
      const { createConvexApi } = await import("./agent.js")
      const api = createConvexApi(
        session.convexUrl ?? config.convexUrl,
        session.getToken ??
          (async () => {
            throw new AgentError("UNAUTHENTICATED", "Run `neram login` first.")
          })
      )
      const server = createNeramMcpServer(api)
      const [ct, st] = InMemoryTransport.createLinkedPair()
      const client = new Client({ name: "neram-cli", version: packageVersion() })
      await Promise.all([server.connect(st), client.connect(ct)])
      try {
        const { buildMcpList } = await import("./mcp-list.js")
        const { payload, human } = await buildMcpList(client)
        emit(opts, human, payload)
      } finally {
        await client.close()
        await server.close()
      }
    })
  )

program
  .command("daily")
  .alias("brief")
  .description("Show a compact daily execution digest")
  .option(
    "--project-limit <n>",
    "Projects to scan for open work (1-20).",
    toInt
  )
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const brief = await (
        await tools()
      ).daily_brief({ projectLimit: opts.projectLimit })
      emit(opts, formatDailyBrief(brief), brief)
    })
  )

program
  .command("activity")
  .description("Show your recent activity feed")
  .option("--limit <n>", "Items to return (1-50).", toInt)
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).recent_activity({ limit: opts.limit })
      emit(opts, formatActivity(result), result)
    })
  )

const task = program.command("task").description("Create and manage tasks")
task
  .command("add")
  .description("Create a task in a project")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .requiredOption("-t, --title <title>")
  .option("-d, --description <description>")
  .option("--due <yyyy-mm-dd>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).capture_task({
        ...projectRef(opts),
        title: opts.title,
        description: opts.description,
        dueDate: opts.due,
      })
      emit(opts, formatCaptureTask(result), result)
    })
  )
task
  .command("list")
  .description("List a project's tasks, optionally filtered by status")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("--status <todo|inProgress|done>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).list_tasks({ ...projectRef(opts), status: opts.status })
      emit(opts, formatTaskList(result), result)
    })
  )
task
  .command("show")
  .description("Show one task with child counts")
  .requiredOption("--task-id <id>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (await tools()).get_task({ taskId: opts.taskId })
      emit(opts, formatTaskDetail(result), result)
    })
  )
task
  .command("move")
  .description("Move or reorder a task by status")
  .requiredOption("--status <todo|inProgress|done>")
  .option("--task-id <id>")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("-t, --title <title>")
  .option(
    "--position <number>",
    "Fractional board position.",
    Number.parseFloat
  )
  .option("--confirm-incomplete-subtasks")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).move_task({
        ...taskRef(opts),
        status: opts.status,
        position: opts.position,
        confirmIncompleteSubtasks: opts.confirmIncompleteSubtasks,
      })
      emit(opts, formatTaskMoved(result), result)
    })
  )
task
  .command("done")
  .description("Mark a task done")
  .option("--task-id <id>")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("-t, --title <title>")
  .option("--confirm-incomplete-subtasks")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).complete_task({
        ...taskRef(opts),
        confirmIncompleteSubtasks: opts.confirmIncompleteSubtasks,
      })
      emit(opts, formatTaskMoved(result), result)
    })
  )
task
  .command("update")
  .description(
    "Update a task's title, description, or due date, or clear its assignee"
  )
  .option("--task-id <id>")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option(
    "--task-title <title>",
    "Address the task by title within the project."
  )
  .option("--title <title>", "New title.")
  .option("-d, --description <description>", "New description.")
  .option("--due <yyyy-mm-dd>", "New due date.")
  .option("--clear-assignee", "Remove the current assignee.")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).update_task({
        taskId: opts.taskId,
        ...projectRef(opts),
        taskTitle: opts.taskTitle,
        title: opts.title,
        description: opts.description,
        dueDate: opts.due,
        clearAssignee: opts.clearAssignee,
      })
      emit(opts, formatTaskUpdated(result), result)
    })
  )
task
  .command("rm")
  .description("Delete a task")
  .option("--task-id <id>")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("-t, --title <title>")
  .option("--confirm-cascade")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).delete_task({
        ...taskRef(opts),
        confirmCascade: opts.confirmCascade,
      })
      emit(opts, formatTaskDeleted(result), result)
    })
  )

const subtask = task.command("subtask").description("Manage one-level subtasks")
subtask
  .command("list")
  .requiredOption("--task-id <id>")
  .option("--hide-completed")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).list_subtasks({
        taskId: opts.taskId,
        hideCompleted: opts.hideCompleted,
      })
      emit(opts, formatSubtasks(result), result)
    })
  )
subtask
  .command("add")
  .requiredOption("--task-id <id>")
  .requiredOption("--title <title>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (await tools()).create_subtask(opts)
      emit(opts, formatCreated("Created subtask", result.subtaskId), result)
    })
  )
subtask
  .command("rename")
  .requiredOption("--subtask-id <id>")
  .requiredOption("--title <title>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (await tools()).rename_subtask(opts)
      emit(opts, formatCreated("Renamed subtask", result.subtaskId), result)
    })
  )
for (const [name, completed] of [
  ["done", true],
  ["reopen", false],
] as const) {
  subtask
    .command(name)
    .requiredOption("--subtask-id <id>")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (
          await tools()
        ).set_subtask_completed({
          subtaskId: opts.subtaskId,
          completed,
        })
        emit(
          opts,
          formatCreated(
            completed ? "Completed subtask" : "Reopened subtask",
            result.subtaskId
          ),
          result
        )
      })
    )
}
subtask
  .command("move")
  .requiredOption("--subtask-id <id>")
  .option("--before-id <id>")
  .option("--after-id <id>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).reorder_subtask({
        subtaskId: opts.subtaskId,
        beforeSubtaskId: opts.beforeId,
        afterSubtaskId: opts.afterId,
      })
      emit(opts, formatCreated("Moved subtask", result.subtaskId), result)
    })
  )
subtask
  .command("rm")
  .requiredOption("--subtask-id <id>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (await tools()).delete_subtask(opts)
      emit(opts, formatCreated("Deleted subtask", result.subtaskId), result)
    })
  )

const comment = task
  .command("comment")
  .description("Manage threaded task comments")
comment
  .command("list")
  .requiredOption("--task-id <id>")
  .option("--parent-comment-id <id>")
  .option("--limit <n>", "Page size (1-20).", toInt)
  .option("--cursor <cursor>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).list_task_comments({
        taskId: opts.taskId,
        parentCommentId: opts.parentCommentId,
        pageSize: opts.limit,
        cursor: opts.cursor,
      })
      emit(opts, formatComments(result), result)
    })
  )
comment
  .command("add")
  .requiredOption("--task-id <id>")
  .requiredOption("--body <text>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).create_comment({
        taskId: opts.taskId,
        segments: parseInlineMentions(opts.body),
      })
      emit(opts, formatCreated("Posted comment", result.commentId), result)
    })
  )
comment
  .command("reply")
  .requiredOption("--comment-id <id>")
  .requiredOption("--body <text>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).reply_to_comment({
        commentId: opts.commentId,
        segments: parseInlineMentions(opts.body),
      })
      emit(opts, formatCreated("Posted reply", result.commentId), result)
    })
  )
comment
  .command("edit")
  .requiredOption("--comment-id <id>")
  .requiredOption("--body <text>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).edit_comment({
        commentId: opts.commentId,
        segments: parseInlineMentions(opts.body),
      })
      emit(opts, formatCreated("Edited comment", result.commentId), result)
    })
  )
comment
  .command("rm")
  .requiredOption("--comment-id <id>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (await tools()).delete_comment(opts)
      emit(opts, formatCreated("Deleted comment", result.commentId), result)
    })
  )
task
  .command("move-to")
  .description("Move a task to another project")
  .option("--task-id <id>")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("-t, --title <title>")
  .option("--to-project <name>")
  .option("--to-project-id <id>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).move_task_to_project({
        ...taskRef(opts),
        toProject: opts.toProject,
        toProjectId: opts.toProjectId,
      })
      emit(opts, formatTaskMovedToProject(result), result)
    })
  )

const project = program
  .command("project")
  .description("Create and manage projects")
project
  .command("list")
  .description("List every project you can see")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (await tools()).list_projects({})
      emit(opts, formatProjectList(result), result)
    })
  )
project
  .command("add")
  .description("Create a new project")
  .requiredOption("--name <name>")
  .option("--icon <icon>")
  .option("--color <color>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).create_project({ name: opts.name, icon: opts.icon, color: opts.color })
      emit(opts, formatProjectCreated(result), result)
    })
  )
project
  .command("update")
  .description("Update a project's name, icon, or color")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("--name <name>")
  .option("--icon <icon>")
  .option("--color <color>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).update_project({
        ...projectRef(opts),
        name: opts.name,
        icon: opts.icon,
        color: opts.color,
      })
      emit(opts, formatProjectUpdated(result), result)
    })
  )
project
  .command("rm")
  .description("Delete a project and all of its tasks")
  .requiredOption("--project-id <id>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).delete_project({ projectId: opts.projectId })
      emit(opts, formatProjectDeleted(result), result)
    })
  )
project
  .command("summary")
  .description("Show a project's tasks and status counts")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("--json")
  .action((opts) =>
    wrap(opts, async () => {
      const result = await (
        await tools()
      ).summarize_project({ ...projectRef(opts) })
      emit(opts, formatProjectSummary(result), result)
    })
  )

registerPlanningCommands(program, { tools, emit, wrap })

program.parse()
