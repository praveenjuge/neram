#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { Command } from "commander"

import { createTools, toAgentError } from "./agent.js"
import { authClient, claims, loadPublicConfig, login, logout } from "./auth.js"
import { runStdioMcp } from "./mcp.js"

type OutputOptions = { json?: boolean }

function print(value: unknown, options: OutputOptions = {}) {
  if (options.json || typeof value !== "string") {
    console.log(JSON.stringify(value, null, 2))
  } else {
    console.log(value)
  }
}

function wrap(fn: () => Promise<void>) {
  fn().catch((error) => {
    const err = toAgentError(error)
    console.error(JSON.stringify({ ok: false, error: { code: err.code, message: err.message, details: err.details } }))
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
  .action((opts) => wrap(async () => {
    const who = await login({
      convexUrl: opts.convexUrl,
      clerkFrontendApiUrl: opts.clerkFrontendApiUrl,
      oauthClientId: opts.oauthClientId,
    })
    print({ ok: true, user: who }, opts)
  }))

program.command("logout").option("--json").action((opts) => wrap(async () => {
  await logout()
  print({ ok: true }, opts)
}))

program.command("whoami").option("--json").action((opts) => wrap(async () => {
  const { session, client } = await authClient()
  await client.projects()
  print({ ok: true, user: claims(session.idToken), convexUrl: session.config.convexUrl }, opts)
}))

program.command("doctor").option("--json").action((opts) => wrap(async () => {
  const config = await loadPublicConfig()
  const mcp = { stdio: "neram mcp", hosted: "https://neram.praveenjuge.com/mcp" }
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

program.command("mcp").description("Start the local stdio MCP server").action(() => wrap(async () => {
  const { client } = await authClient()
  await runStdioMcp(client)
}))

program.command("daily").alias("brief").option("--json").action((opts) => wrap(async () => {
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
  .action((opts) => wrap(async () => {
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
  .action((opts) => wrap(async () => {
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
  .action((opts) => wrap(async () => {
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
  .action((opts) => wrap(async () => {
    print(await (await tools()).check_in_project({
      ...projectRef(opts),
    }), opts)
  }))
project.command("summary")
  .option("-p, --project <name>")
  .option("--project-id <id>")
  .option("--json")
  .action((opts) => wrap(async () => {
    print(await (await tools()).summarize_project({
      ...projectRef(opts),
    }), opts)
  }))

program.parse()
