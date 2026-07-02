import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
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
  ],
}

export default nextConfig
