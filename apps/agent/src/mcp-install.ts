import { homedir } from "node:os"
import { dirname, join } from "node:path"
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

function snippet(client: string) {
  // VS Code's `servers` entries require an explicit stdio transport type.
  return client === "vscode"
    ? { type: "stdio", command: "npx", args: ["neram", "mcp"] }
    : { command: "npx", args: ["neram", "mcp"] }
}

/**
 * Parent directory of a client config path on any platform.
 *
 * Config paths are built with `join()` from `homedir()`, so on Windows they
 * are backslash-separated. A naive `path.split("/")` never splits those and
 * `mkdir` would receive the wrong directory. Only Windows-shaped paths
 * (drive-letter or UNC prefixes) are normalized: a literal backslash is a
 * valid POSIX filename character, so POSIX paths pass through untouched and
 * `mkdir` always targets the same directory `writeFile` writes into.
 * Forward slashes are accepted by Node fs APIs on Windows, so the normalized
 * parent is safe to pass to `mkdir`.
 */
export function parentDir(configPath: string): string {
  const isWindowsPath = /^[A-Za-z]:[\\/]|^\\\\/.test(configPath)
  return dirname(isWindowsPath ? configPath.replace(/\\/g, "/") : configPath)
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
  } catch (error) {
    // Only a missing file starts from empty. A malformed or unreadable
    // config must never be silently replaced — the user could lose settings.
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      existing = {}
    } else {
      const human = `Refusing to overwrite ${path}: existing config is unreadable (${(error as Error)?.message ?? error}). Fix or back it up, then re-run.`
      return { human, json: { ok: false, client: target, path, error: human } }
    }
  }
  const key = target === "vscode" ? "servers" : "mcpServers"
  const current = (existing[key] as Record<string, unknown> | undefined) ?? {}
  if (!opts.merge && current["neram"]) {
    const human = `neram entry already exists in ${path}. Re-run with --merge to merge.`
    return { human, json: { ok: false, client: target, path } }
  }
  const next = {
    ...existing,
    [key]: { ...current, neram: snippet(target) },
  }
  await mkdir(parentDir(path), { recursive: true })
  await writeFile(path, JSON.stringify(next, null, 2) + "\n")
  const human = `Wrote neram MCP server to ${path} (${key}.neram). Sign in first: npx neram login`
  return { human, json: { ok: true, client: target, path, key } }
}
