import { defineConfig } from "vitest/config"

// Convex functions run in an edge-like runtime, so we test them with the
// edge-runtime environment. `convex-test` must be inlined so its ESM is
// transformed by Vite. A dedicated config keeps the app's Vite plugins
// (router/react) out of the backend test run.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
})
