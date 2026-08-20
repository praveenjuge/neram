#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const rawDeploymentId = process.env.VERCEL_DEPLOYMENT_ID

if (!rawDeploymentId) {
  console.log("[deployment-assets] Skipped outside Vercel")
  process.exit(0)
}

const deploymentId = rawDeploymentId.replace(/^dpl_/, "").slice(0, 32)
const htmlPath = resolve(
  import.meta.dirname,
  "../.next/server/app/sign-in.html"
)
const serverFilesPath = resolve(
  import.meta.dirname,
  "../.next/required-server-files.json"
)
const html = readFileSync(htmlPath, "utf8")
const serverFiles = JSON.parse(readFileSync(serverFilesPath, "utf8"))
const assetUrls = [
  ...html.matchAll(/(?:href|src)="([^"]*\/_next\/static[^"]*)"/g),
].map(([, url]) => url)
const expectedQuery = `?dpl=${deploymentId}`
const unversionedUrls = assetUrls.filter((url) => !url.includes(expectedQuery))
const outputHashSalt = serverFiles.config?.experimental?.outputHashSalt

if (assetUrls.length === 0 || outputHashSalt !== deploymentId) {
  console.error(
    `[deployment-assets] Expected the Next.js output hash salt to match this deployment; ` +
      `found ${assetUrls.length} asset URL(s)`
  )
  process.exit(1)
}

console.log(
  `[deployment-assets] ${assetUrls.length} Next.js asset URL(s) use deployment-specific hashes` +
    (unversionedUrls.length === 0 ? " and deployment query strings" : "")
)
