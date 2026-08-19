#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

function extractMcpTools() {
  const mcpPath = resolve(root, "../agent/src/mcp.ts")
  let content
  try {
    content = readFileSync(mcpPath, "utf8")
  } catch {
    // When running from web, agent path is ../agent/src/mcp.ts relative to apps/web
    const alt = resolve(root, "../../apps/agent/src/mcp.ts")
    content = readFileSync(alt, "utf8")
  }
  const re = /register\(\s*"([^"]+)"/g
  const tools = []
  let m
  while ((m = re.exec(content))) tools.push(m[1])
  return tools
}

function extractCliCommands() {
  const cliPath = resolve(root, "../../apps/agent/src/cli.ts")
  let content
  try {
    content = readFileSync(cliPath, "utf8")
  } catch {
    content = readFileSync(resolve(root, "../agent/src/cli.ts"), "utf8")
  }
  // Extract .command("...") occurrences
  const re = /\.command\("([^"]+)"\)/g
  const cmds = []
  let m
  while ((m = re.exec(content))) cmds.push(m[1])
  return cmds
}

function check() {
  const mcpTools = extractMcpTools()
  const mcpDocPath = resolve(root, "src/app/(marketing)/docs/mcp/page.tsx")
  const mcpDoc = readFileSync(mcpDocPath, "utf8")
  const missingMcp = mcpTools.filter((t) => !mcpDoc.includes(t))
  if (missingMcp.length) {
    console.error(`[drift] MCP doc missing tools: ${missingMcp.join(", ")}`)
    console.error(`  Expected ${mcpTools.length} tools, found ${mcpTools.length - missingMcp.length}`)
    process.exitCode = 1
  } else {
    console.log(`[drift] MCP tools ok: ${mcpTools.length} tools present`)
  }

  const cliCommands = extractCliCommands()
  const cliDocPath = resolve(root, "src/app/(marketing)/docs/cli/page.tsx")
  const cliDoc = readFileSync(cliDocPath, "utf8")
  // Check that key commands appear as substrings in the doc's code blocks
  const required = ["login", "doctor", "whoami", "daily", "task", "project", "workspace", "sprint"]
  const missingCli = required.filter((c) => !cliDoc.includes(c))
  if (missingCli.length) {
    console.error(`[drift] CLI doc missing keywords: ${missingCli.join(", ")}`)
    process.exitCode = 1
  } else {
    console.log(`[drift] CLI doc ok: contains ${required.join(", ")}`)
  }

  // Also validate search index has entries for each top-level docs href
  const searchPath = resolve(root, "src/lib/docs-search.ts")
  const searchContent = readFileSync(searchPath, "utf8")
  const hrefs = ["/docs", "/docs/cli", "/docs/mcp", "/docs/concepts", "/docs/reference"]
  const missingSearch = hrefs.filter((h) => !searchContent.includes(`"${h}"`))
  if (missingSearch.length) {
    console.error(`[drift] search index missing hrefs: ${missingSearch.join(", ")}`)
    process.exitCode = 1
  } else {
    console.log(`[drift] search index ok`)
  }

  if (process.exitCode) {
    console.error("[drift] Drift detected — update docs to match agent/src/mcp.ts and cli.ts")
    process.exit(1)
  }
  console.log("[drift] All checks passed")
}

check()
