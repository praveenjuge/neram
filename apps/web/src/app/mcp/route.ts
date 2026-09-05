import { createConvexApi } from "neram"
import { handleFetchMcp } from "neram/mcp"
import { requireOrganizationClaims } from "neram/session"

const corsHeaders = {
  "access-control-allow-headers":
    "authorization, content-type, mcp-session-id, mcp-method, mcp-name, mcp-protocol-version",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "mcp-method, mcp-name",
}

const RESOURCE_METADATA_URL =
  "https://neram.praveenjuge.com/.well-known/oauth-protected-resource"

function unauthorized(code: string, message: string, scope?: string) {
  const challenge =
    `Bearer realm="Neram MCP", resource_metadata="${RESOURCE_METADATA_URL}"` +
    (scope ? `, scope="${scope}"` : "")
  return { challenge, payload: { error: { code, message } } }
}

function bearer(request: Request) {
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return null
  return header.slice("Bearer ".length).trim()
}

function withCors(response: Response) {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders, status: 204 })
}

// Stateless discovery probe: clients may GET the endpoint to learn the
// protocol versions and auth model before POSTing. Never requires a token.
export function GET() {
  return Response.json(
    {
      protocol: "MCP 2026-07-28 (stateless Streamable HTTP; no session)",
      versions: ["2026-07-28", "2025-11-25"],
      headers: {
        required: [],
        routing: ["Mcp-Method", "Mcp-Name"],
        version: "MCP-Protocol-Version",
      },
      discovery: "POST tools/call server/discover when supported by your SDK",
      authorization: {
        type: "bearer",
        token: "Clerk OAuth id_token",
        resourceMetadata: RESOURCE_METADATA_URL,
      },
      tools: "POST tools/list after discovery",
    },
    { headers: corsHeaders }
  )
}

export async function POST(request: Request) {
  const token = bearer(request)
  if (!token) {
    const { challenge, payload } = unauthorized(
      "UNAUTHENTICATED",
      "Bearer token required.",
      "workspace:read"
    )
    return Response.json(payload, {
      headers: {
        ...corsHeaders,
        "www-authenticate": challenge,
      },
      status: 401,
    })
  }
  try {
    requireOrganizationClaims(token)
  } catch {
    const { challenge, payload } = unauthorized(
      "ORGANIZATION_REQUIRED",
      "Choose a Neram workspace and authorize MCP again.",
      "workspace:read"
    )
    return Response.json(payload, {
      headers: {
        ...corsHeaders,
        "www-authenticate": challenge,
      },
      status: 401,
    })
  }

  const convexUrl =
    process.env.NERAM_CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) {
    return Response.json(
      {
        error: {
          code: "MISSING_CONFIG",
          message: "NERAM_CONVEX_URL is not configured.",
        },
      },
      { headers: corsHeaders, status: 500 }
    )
  }

  return withCors(
    await handleFetchMcp(request, createConvexApi(convexUrl, token))
  )
}
