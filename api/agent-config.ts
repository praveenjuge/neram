import type { IncomingMessage, ServerResponse } from "node:http"

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  const body = {
    convexUrl: process.env.NERAM_CONVEX_URL ?? process.env.VITE_CONVEX_URL,
    clerkFrontendApiUrl: process.env.NERAM_CLERK_FRONTEND_API_URL ?? process.env.CLERK_FRONTEND_API_URL,
    oauthClientId: process.env.NERAM_CLERK_OAUTH_CLIENT_ID,
  }
  if (!body.convexUrl || !body.clerkFrontendApiUrl || !body.oauthClientId) {
    res.writeHead(500, { "content-type": "application/json" })
    res.end(JSON.stringify({ error: "Neram agent config is incomplete." }))
    return
  }
  res.writeHead(200, {
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=300",
    "content-type": "application/json",
  })
  res.end(JSON.stringify(body))
}
