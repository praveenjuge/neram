#!/usr/bin/env node
import { globSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const rawDeploymentId = process.env.VERCEL_DEPLOYMENT_ID
const publicDir = resolve(import.meta.dirname, "../public")
const manifest = JSON.parse(
  readFileSync(resolve(publicDir, "manifest.webmanifest"), "utf8")
)
const appAssets = ["pwa-192.png", "pwa-512.png", "pwa-icon.svg"]

for (const asset of appAssets) {
  readFileSync(resolve(publicDir, asset))
}

if (manifest.start_url !== "/") {
  console.error(
    `[deployment-assets] Expected manifest start_url /; found ${String(manifest.start_url)}`
  )
  process.exit(1)
}

console.log(
  `[deployment-assets] Manifest and ${appAssets.length} install assets verified`
)

if (!rawDeploymentId) {
  console.log(
    "[deployment-assets] Deployment-specific checks skipped outside Vercel"
  )
  process.exit(0)
}

const deploymentId = rawDeploymentId.replace(/^dpl_/, "").slice(0, 32)
const appOutputDir = resolve(import.meta.dirname, "../.next/server/app")
const htmlPaths = globSync("**/*.html", { cwd: appOutputDir }).map((path) =>
  resolve(appOutputDir, path)
)
const serverFilesPath = resolve(
  import.meta.dirname,
  "../.next/required-server-files.json"
)
const html = htmlPaths.map((path) => readFileSync(path, "utf8")).join("\n")
const serverFiles = JSON.parse(readFileSync(serverFilesPath, "utf8"))
const assetUrls = [
  ...html.matchAll(/(?:href|src)="([^"]*\/_next\/static[^"]*)"/g),
].map(([, url]) => url)
const expectedQuery = `?dpl=${deploymentId}`
const unversionedUrls = assetUrls.filter((url) => !url.includes(expectedQuery))
const outputHashSalt = serverFiles.config?.experimental?.outputHashSalt
if (
  assetUrls.length === 0 ||
  typeof outputHashSalt !== "string" ||
  outputHashSalt.length === 0
) {
  console.error(
    `[deployment-assets] Expected a non-empty Next.js output hash salt; ` +
      `found ${assetUrls.length} asset URL(s)`
  )
  process.exit(1)
}

console.log(
  `[deployment-assets] ${assetUrls.length} Next.js asset URL(s) use deployment-specific hashes` +
    (unversionedUrls.length === 0 ? " and deployment query strings" : "")
)
