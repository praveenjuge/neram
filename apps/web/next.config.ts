import { createMDX } from "fumadocs-mdx/next"
import type { NextConfig } from "next"

const deploymentId = process.env.VERCEL_DEPLOYMENT_ID?.replace(
  /^dpl_/,
  ""
).slice(0, 32)

const nextConfig: NextConfig = {
  cacheComponents: true,
  deploymentId,
  experimental: {
    exposeTestingApiInProductionBuild: true,
    optimizePackageImports: [
      "@clerk/nextjs",
      "@clerk/ui",
      "convex",
      "date-fns",
      "fumadocs-core",
      "fumadocs-ui",
      "lucide-react",
      "next-themes",
      "radix-ui",
      "sonner",
    ],
    outputHashSalt: deploymentId,
    // Turbopack FS build cache stays off: restoring .next/cache across
    // deploys once served a stale compiled globals.css (old font stack).
    // Next 16.3 hardened this cache on Vercel's own sites, so re-enable
    // only after verifying CSS output with check-deployment-assets.mjs.
    // prefetchInlining is default-on in 16.3, so no config needed here.
    turbopackFileSystemCacheForBuild: false,
    turbopackRustReactCompiler: true,
    // Network resilience: pending navigations/prefetches/Server Actions
    // wait and retry on reconnect instead of throwing when offline.
    useOffline: true,
  },
  partialPrefetching: true,
  poweredByHeader: false,
  reactCompiler: true,
  redirects: async () => [
    {
      source: "/sign-in",
      destination:
        "https://accounts.neram.praveenjuge.com/sign-in?redirect_url=https%3A%2F%2Fneram.praveenjuge.com%2Fw",
      permanent: false,
    },
  ],
  rewrites: async () => [
    {
      source: "/.well-known/neram-agent.json",
      destination: "/api/agent-config",
    },
    // Per-page markdown dumps, e.g. /docs/cli.md and /docs/cli.mdx
    {
      source: "/docs/:path*.mdx",
      destination: "/api/docs-source/mdx/:path*",
    },
    {
      source: "/docs/:path*.md",
      destination: "/api/docs-source/md/:path*",
    },
  ],
}

const withMDX = createMDX()

export default withMDX(nextConfig)
