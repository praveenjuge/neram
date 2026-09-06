import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test, vi } from "vitest"

import { writeMcpInstall, parentDir } from "../src/mcp-install.js"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("mcp install writer", () => {
  test("refuses to overwrite malformed configs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "neram-mcp-install-"))
    mkdirSync(join(dir, ".cursor"), { recursive: true })
    const path = join(dir, ".cursor", "mcp.json")
    writeFileSync(path, "{ not valid json")

    vi.stubEnv("HOME", dir)
    const result = await writeMcpInstall("cursor", { merge: true })
    expect(result.json).toMatchObject({ ok: false })
    // Original malformed content is preserved.
    expect(readFileSync(path, "utf8")).toBe("{ not valid json")
  })

  test("creates a fresh config when none exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "neram-mcp-install-"))
    vi.stubEnv("HOME", dir)
    const result = await writeMcpInstall("opencode", { merge: true })
    expect(result.json).toMatchObject({ ok: true })
    const saved = JSON.parse(
      readFileSync(join(dir, ".config", "opencode", "mcp.json"), "utf8")
    ) as { mcpServers: { neram: { command: string } } }
    expect(saved.mcpServers.neram.command).toBe("npx")
  })

  test("parentDir splits backslash-separated (Windows) paths", () => {
    // Regression lock for the dirname() fix: the old
    // `path.split("/").slice(0, -1).join("/")` never split a Windows path
    // (it yields ""), so mkdir never received the real parent directory.
    const windowsPath = "C:\\Users\\ada\\.cursor\\mcp.json"
    expect(windowsPath.split("/").slice(0, -1).join("/")).toBe("")
    expect(parentDir(windowsPath)).toBe("C:/Users/ada/.cursor")
    // POSIX paths keep working.
    expect(parentDir("/home/ada/.cursor/mcp.json")).toBe("/home/ada/.cursor")
  })
})
