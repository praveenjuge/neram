import type { NextConfig } from "next"

const deploymentId = process.env.VERCEL_DEPLOYMENT_ID?.replace(
  /^dpl_/,
  ""
).slice(0, 32)

const nextConfig: NextConfig = {
  cacheComponents: true,
  deploymentId,
  experimental: {
    outputHashSalt: deploymentId,
    turbopackFileSystemCacheForBuild: true,
    turbopackRustReactCompiler: true,
  },
  partialPrefetching: true,
  reactCompiler: true,
  rewrites: async () => [
    {
      source: "/.well-known/neram-agent.json",
      destination: "/api/agent-config",
    },
    {
      source: "/",
      destination: "/index.html",
    },
    {
      source: "/docs",
      destination: "/docs/index.html",
    },
    {
      source: "/docs/:path*",
      destination: "/docs/:path*/index.html",
    },
  ],
}

export default nextConfig
