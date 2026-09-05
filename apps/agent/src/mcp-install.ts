import { homedir } from "node:os"
import { join } from "node:path"
import { mkdir, readFile, writeFile } from "node:fs/promises"

type WriteOptions = { merge?: boolean }

function targetPath(client: string): string | null {
  const home = homedir()
  switch (client.toLowerCase()) {
    case "claude-code":
      return join(home, ".claude.json")
    case "cursor":
      return join(home, ".cursor", "mcp.json")
    case "vscode":
      return join(home, ".vscode", "mcp.json")
    case "opencode":
      return join(home, ".config", "opencode", "mcp.json")
    case "goose":
      return join(home, ".config", "goose", "mcp.json")
    default:
      return null
  }
}

function snippet() {
  return { command: "npx", args: ["neram", "mcp"] }
}

/** Write the stdio snippet into a client config file (opt-in only). */
export async function writeMcpInstall(
  client: string | undefined,
  opts: WriteOptions = {}
): Promise<{ human: string; json: unknown }> {
  const target = (client ?? "generic").toLowerCase()
  const path = targetPath(target)
  if (!path) {
    const human = `Unknown client "${target}". Supported for --write: claude-code, cursor, vscode, opencode, goose.`
    return { human, json: { ok: false, client: target, error: human } }
  }
  let existing: Record<string, unknown>
  try {
    existing = JSON.parse(await readFile(path, "utf8")) as Record<
      string,
      unknown
    >
  } catch {
    existing = {}
  }
  const key = target === "vscode" ? "servers" : "mcpServers"
  const current = (existing[key] as Record<string, unknown> | undefined) ?? {}
  if (!opts.merge && current["neram"]) {
    const human = `neram entry already exists in ${path}. Re-run with --merge to merge.`
    return { human, json: { ok: false, client: target, path } }
  }
  const next = {
    ...existing,
    [key]: { ...current, neram: snippet() },
  }
  const dir = path.split("/").slice(0, -1).join("/")
  await mkdir(dir, { recursive: true })
  await writeFile(path, JSON.stringify(next, null, 2) + "\n")
  const human = `Wrote neram MCP server to ${path} (${key}.neram). Sign in first: npx neram login`
  return { human, json: { ok: true, client: target, path, key } }
}
