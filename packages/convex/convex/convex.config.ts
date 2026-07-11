import { defineApp } from "convex/server"
import { v } from "convex/values"

const app = defineApp({
  env: {
    CLERK_FRONTEND_API_URL: v.optional(v.string()),
    CLERK_SECRET_KEY: v.optional(v.string()),
    CLERK_WEBHOOK_SIGNING_SECRET: v.optional(v.string()),
    NERAM_CLERK_OAUTH_CLIENT_ID: v.optional(v.string()),
  },
})

export default app
