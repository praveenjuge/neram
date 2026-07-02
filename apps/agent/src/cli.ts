#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { Command } from "commander"

import { createTools, toAgentError } from "./agent.js"
import { authClient, claims, loadPublicConfig, login, logout } from "./auth.js"
import {
  formatError,
  formatLogin,
  formatLogout,
  formatWhoami,
  loginPayload,
  logoutPayload,
  MCP_INFO,
  whoamiPayload,
} from "./format.js"
import { runStdioMcp } from "./mcp.js"

type OutputOptions = { json?: boolean }

function print(value: unknown, options: OutputOptions = {}) {
  if (options.json || typeof value !== "string") {
    console.log(JSON.stringify(value, null, 2))
  } else {
    console.log(value)
  }
}

// Emit polished human text by default and stable, machine-readable JSON when
// `--json` is passed. Human is the quiet default; JSON stays additive.
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

function packageVersion() {
  try {
    const packagePath = join(dirname(fileURLToPath(import.meta.url)), "../package.json")
    return JSON.parse(readFileSync(packagePath, "utf8")).version as string
  } catch {
    return "0.0.0"
  }
}

const program = new Command()
program.name("neram").description("Neram workspace CLI for AI agents").version(packageVersion())

program.command("login")
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

program.command("logout").option("--json").action((opts) => wrap(opts, async () => {
  const result = await logout()
  emit(opts, formatLogout(result), logoutPayload(result))
}))

program.command("whoami").option("--json").action((opts) => wrap(opts, async () => {
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

program.command("doctor").option("--json").action((opts) => wrap(opts, async () => {
  const config = await loadPublicConfig()
  const mcp = { stdio: MCP_INFO.stdio, hosted: MCP_INFO.hosted }
  try {
    const { session, client } = await authClient()
    const projects = await client.projects()
    print({
      ok: true,
      config,
      token: {
        issuer: claims(session.idToken).iss,
        audience: claims(session.idToken).aud,
        expiresAt: new Date(session.expiresAt).toISOString(),
      },
      convex: { authenticated: true, visibleProjects: projects.length },
      mcp,
    }, opts)
  } catch (error) {
    const err = toAgentError(error)
    print({
      ok: false,
      config,
      auth: {
        authenticated: false,
        error: { code: err.code, message: err.message, details: err.details },
      },
      mcp,
    }, opts)
    process.exitCode = 1
  }
}))

program.command("mcp").description("Start the local stdio MCP server").action(() => wrap({}, async () => {
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

program.command("daily").alias("brief").option("--json").action((opts) => wrap(opts, async () => {
  print(await (await tools()).daily_brief({}), opts)
}))

const task = program.command("task")
task.command("add")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .requiredOption("-t, --title <title>")
  .option("-d, --description <description>")
  .option("--due <yyyy-mm-dd>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    print(await (await tools()).capture_task({
      ...projectRef(opts),
      title: opts.title,
      description: opts.description,
      dueDate: opts.due,
    }), opts)
  }))
task.command("move")
  .requiredOption("--status <todo|inProgress|done>")
  .option("--task-id <id>")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("-t, --title <title>")
  .option("--position <number>", "Fractional board position.", Number.parseFloat)
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    print(await (await tools()).move_task({
      taskId: opts.taskId,
      ...projectRef(opts),
      taskTitle: opts.title,
      status: opts.status,
      position: opts.position,
    }), opts)
  }))
task.command("done")
  .option("--task-id <id>")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("-t, --title <title>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    print(await (await tools()).complete_task({
      taskId: opts.taskId,
      ...projectRef(opts),
      taskTitle: opts.title,
    }), opts)
  }))

const project = program.command("project")
project.command("check-in")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    print(await (await tools()).check_in_project({
      ...projectRef(opts),
    }), opts)
  }))
project.command("summary")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("--json")
  .action((opts) => wrap(opts, async () => {
    print(await (await tools()).summarize_project({
      ...projectRef(opts),
    }), opts)
  }))

program.parse()
