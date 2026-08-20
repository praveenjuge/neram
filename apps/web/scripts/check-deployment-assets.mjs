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
const html = readFileSync(htmlPath, "utf8")
const assetUrls = [
  ...html.matchAll(/(?:href|src)="([^"]*\/_next\/static[^"]*)"/g),
].map(([, url]) => url)
const expectedQuery = `?dpl=${deploymentId}`
const unversionedUrls = assetUrls.filter((url) => !url.includes(expectedQuery))

if (assetUrls.length === 0 || unversionedUrls.length > 0) {
  console.error(
    `[deployment-assets] Expected every Next.js asset URL to include ${expectedQuery}; ` +
      `found ${unversionedUrls.length} unversioned URL(s) across ${assetUrls.length} asset(s)`
  )
  process.exit(1)
}

console.log(
  `[deployment-assets] ${assetUrls.length} Next.js asset URL(s) use deployment cache busting`
)
