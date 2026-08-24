#!/usr/bin/env node
// Live stdio-MCP handshake test against the BUILT neram CLI.
// Spawns `node dist/cli.js mcp`, speaks real JSON-RPC over stdin/stdout,
// and verifies the server stays alive and healthy even when unauthenticated.
import { spawn } from "node:child_process"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const dist =
  process.env.NERAM_CLI ||
  join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js")

const child = spawn("node", [dist, "mcp"], {
  stdio: ["pipe", "pipe", "pipe"],
})

let buf = ""
let pending = new Map()
let nextId = 1

function send(method, params = {}) {
  const id = nextId++
  const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"
  child.stdin.write(msg)
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method })
  })
}

function parseOut() {
  let idx
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim()
    buf = buf.slice(idx + 1)
    if (!line) continue
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      console.log("NON-JSON ON STDOUT (protocol corruption!):", line)
      continue
    }
    if (obj.id && pending.has(obj.id)) {
      const p = pending.get(obj.id)
      pending.delete(obj.id)
      if (obj.error) p.reject(new Error(JSON.stringify(obj.error)))
      else p.resolve(obj.result)
    }
  }
}

child.stdout.on("data", (d) => {
  buf += d.toString()
  parseOut()
})

const stderrChunks = []
child.stderr.on("data", (d) => stderrChunks.push(d.toString()))
child.on("exit", (code) => {
  console.log(`\n[process exited with code ${code}]`)
})

const results = {}
try {
  const init = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "live-test", version: "1.0.0" },
  })
  results.initialize = init.serverInfo ?? "ok"

  await child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) +
      "\n"
  )

  const tools = await send("tools/list")
  results.toolCount = tools.tools?.length ?? -1
  results.firstTools = tools.tools?.slice(0, 3).map((t) => t.name)

  const call = await send("tools/call", {
    name: "list_projects",
    arguments: {},
  })
  results.call = call
} catch (e) {
  results.error = String(e)
} finally {
  console.log(JSON.stringify(results, null, 2))
  console.log(
    "\n[stderr]",
    stderrChunks.join("").slice(0, 400) || "(clean)"
  )
  child.kill()
  process.exit(0)
}