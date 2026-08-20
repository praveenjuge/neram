#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const agent = resolve(root, "../../apps/agent/src");

function extractMcpTools() {
  const content = readFileSync(resolve(agent, "mcp.ts"), "utf8");
  const re = /register\(\s*"([^"]+)"/g;
  const tools = [];
  let m;
  while ((m = re.exec(content))) tools.push(m[1]);
  return tools;
}

function check() {
  const mcpTools = extractMcpTools();
  const mcpDoc = readFileSync(
    resolve(root, "content/docs/mcp.mdx"),
    "utf8"
  );
  const missingMcp = mcpTools.filter((t) => !mcpDoc.includes(t));
  if (missingMcp.length) {
    console.error(`[drift] MCP doc missing tools: ${missingMcp.join(", ")}`);
    console.error(
      `  Expected ${mcpTools.length} tools, found ${mcpTools.length - missingMcp.length}`
    );
    process.exitCode = 1;
  } else {
    console.log(`[drift] MCP tools ok: ${mcpTools.length} tools present`);
  }

  const cliDoc = readFileSync(resolve(root, "content/docs/cli.mdx"), "utf8");
  const required = ["login", "doctor", "whoami", "daily", "task", "project", "workspace", "sprint"];
  const missingCli = required.filter((c) => !cliDoc.includes(c));
  if (missingCli.length) {
    console.error(`[drift] CLI doc missing keywords: ${missingCli.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(`[drift] CLI doc ok: contains ${required.join(", ")}`);
  }

  if (process.exitCode) {
    console.error("[drift] Drift detected — update docs to match agent/src/mcp.ts and cli.ts");
    process.exit(1);
  }
  console.log("[drift] All checks passed");
}

check();
