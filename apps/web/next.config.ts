import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    turbopackFileSystemCacheForBuild: true,
  },
  partialPrefetching: true,
  rewrites: async () => [
    {
      source: "/.well-known/neram-agent.json",
      destination: "/api/agent-config",
    },
  ],
}

export default nextConfig
