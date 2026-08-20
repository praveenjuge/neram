#!/usr/bin/env node
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const docsDist = resolve(root, "../docs/dist")
const publicDir = resolve(root, "public")

// Files and folders the docs build generates. Only these paths are cleaned and
// overwritten so unrelated Next.js public assets remain untouched.
const generated = [
  "404.html",
  "_astro",
  "agent-readability.json",
  "blume-search.json",
  "docs",
  "docs.md",
  "docs.mdx",
  "favicon.svg",
  "index.html",
  "index.md",
  "index.mdx",
  "llms-full.txt",
  "llms.txt",
  "manifest.webmanifest",
  "og",
  "pwa-192.png",
  "pwa-512.png",
  "pwa-icon.svg",
  "robots.txt",
  "sitemap.xml",
]

const requiredAppAssets = [
  "favicon.svg",
  "manifest.webmanifest",
  "pwa-192.png",
  "pwa-512.png",
  "pwa-icon.svg",
]

if (!existsSync(docsDist)) {
  console.error(
    `[sync-docs] Docs build output not found at ${docsDist}. Build @neram/docs first (turbo does this automatically).`
  )
  process.exit(1)
}

for (const name of requiredAppAssets) {
  if (!existsSync(resolve(docsDist, name))) {
    console.error(
      `[sync-docs] Required app asset missing from docs output: ${name}`
    )
    process.exit(1)
  }
}

for (const name of generated) {
  rmSync(resolve(publicDir, name), { recursive: true, force: true })
}

for (const name of readdirSync(docsDist)) {
  if (generated.includes(name)) {
    cpSync(resolve(docsDist, name), resolve(publicDir, name), {
      recursive: true,
    })
  }
}

console.log("[sync-docs] Copied docs build into web public/")
