import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Single source of truth for the package version so the CLI banner and the MCP
// server advertise the same number as package.json. Both the compiled cli.js
// and the compiled mcp.js live in dist/ next to package.json's parent, so the
// relative "../package.json" resolves the same way from either entry point.
export function packageVersion(): string {
  try {
    const packagePath = join(dirname(fileURLToPath(import.meta.url)), "../package.json")
    return JSON.parse(readFileSync(packagePath, "utf8")).version as string
  } catch {
    return "0.0.0"
  }
}
