#!/usr/bin/env node
// Authenticated end-to-end smoke test for the HOSTED Neram MCP endpoint.
//
// POSTs initialize + tools/list + one read-only tools/call against the
// Streamable HTTP endpoint and asserts HTTP 200 at each step.
//
// Auth: a short-lived Clerk id_token via NERAM_ID_TOKEN (never commit one).
// Without NERAM_ID_TOKEN the script skips cleanly (exit 0) so local runs
// and CI jobs without the secret never fail.
//
// Usage:
//   NERAM_ID_TOKEN=<short-lived id_token> node scripts/live-hosted-handshake.mjs
//   NERAM_MCP_URL=https://neram.praveenjuge.com/mcp NERAM_ID_TOKEN=... node scripts/live-hosted-handshake.mjs
const url = process.env.NERAM_MCP_URL ?? "https://neram.praveenjuge.com/mcp"
const token = process.env.NERAM_ID_TOKEN

if (!token) {
  console.log(
    "SKIP: NERAM_ID_TOKEN is not set; refusing to run without a short-lived token."
  )
  process.exit(0)
}

let nextId = 1
async function rpc(method, params = {}, extraHeaders = {}) {
  const id = nextId++
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "mcp-protocol-version": "2025-11-25",
      ...extraHeaders,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  })
  const text = await res.text()
  return { id, status: res.status, text }
}

// Streamable HTTP may answer JSON directly or as an SSE data frame; accept both.
function parseBody(text) {
  const trimmed = text.trim()
  if (!trimmed) throw new Error("empty response body")
  try {
    return JSON.parse(trimmed)
  } catch {
    const data = trimmed
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .join("\n")
    if (!data) throw new Error(`non-JSON response: ${trimmed.slice(0, 200)}`)
    return JSON.parse(data)
  }
}

function assertOk(label, { id, status, text }, check) {
  if (status !== 200) {
    throw new Error(`${label}: expected HTTP 200, got ${status}: ${text.slice(0, 300)}`)
  }
  const payload = parseBody(text)
  if (payload.jsonrpc !== "2.0" || payload.id !== id) {
    throw new Error(`${label}: not a matching JSON-RPC response: ${text.slice(0, 300)}`)
  }
  if (payload.error) throw new Error(`${label}: error: ${JSON.stringify(payload.error)}`)
  check?.(payload.result)
  console.log(`ok: ${label} (http 200, id ${id})`)
  return payload.result
}

const init = await rpc("initialize", {
  protocolVersion: "2025-11-25",
  capabilities: {},
  clientInfo: { name: "live-hosted-handshake", version: "1.0.0" },
})
assertOk("initialize", init, (result) => {
  if (!result?.serverInfo) throw new Error("initialize missing serverInfo")
})

// Fire-and-forget per JSON-RPC: notifications get 202 with no body.
await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
})

const tools = await rpc("tools/list")
assertOk("tools/list", tools, (result) => {
  const names = (result.tools ?? []).map((t) => t.name)
  if (!names.includes("workspace_status")) {
    throw new Error(`tools/list missing workspace_status (got ${names.length} tools)`)
  }
  console.log(`  tools: ${names.length} advertised`)
})

// One read-only call proves the token authorizes real tool execution.
const call = await rpc("tools/call", {
  name: "workspace_status",
  arguments: {},
})
assertOk("tools/call workspace_status", call, (result) => {
  if (result?.isError) {
    throw new Error(`workspace_status isError: ${JSON.stringify(result).slice(0, 300)}`)
  }
})

console.log("\nHOSTED HANDSHAKE PASS")
