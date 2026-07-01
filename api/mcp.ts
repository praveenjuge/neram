import type { IncomingMessage, ServerResponse } from "node:http"

function bearer(req: IncomingMessage) {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) return null
  return header.slice("Bearer ".length).trim()
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader("access-control-allow-origin", "*")
  res.setHeader("access-control-allow-headers", "authorization, content-type, mcp-session-id")
  res.setHeader("access-control-allow-methods", "POST, OPTIONS")
  if (req.method === "OPTIONS") {
    res.writeHead(204).end()
    return
  }
  const token = bearer(req)
  if (!token) {
    res.writeHead(401, {
      "content-type": "application/json",
      "www-authenticate": 'Bearer realm="Neram MCP"',
    })
    res.end(JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Bearer token required." } }))
    return
  }
  const convexUrl = process.env.NERAM_CONVEX_URL ?? process.env.VITE_CONVEX_URL
  if (!convexUrl) {
    res.writeHead(500, { "content-type": "application/json" })
    res.end(JSON.stringify({ error: { code: "MISSING_CONFIG", message: "NERAM_CONVEX_URL is not configured." } }))
    return
  }
  const [{ createConvexApi }, { handleHttpMcp }] = await Promise.all([import("neram"), import("neram/mcp")])
  await handleHttpMcp(req, res, createConvexApi(convexUrl, token))
}
