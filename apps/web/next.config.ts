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
  redirects: async () => [
    {
      source: "/sign-in",
      destination:
        "https://accounts.neram.praveenjuge.com/sign-in?redirect_url=https%3A%2F%2Fneram.praveenjuge.com%2F",
      permanent: false,
    },
  ],
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
