import { createConvexApi } from "neram"
import { requireOrganizationClaims } from "neram/auth"
import { handleFetchMcp } from "neram/mcp"

const corsHeaders = {
  "access-control-allow-headers": "authorization, content-type, mcp-session-id",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*",
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

export async function POST(request: Request) {
  const token = bearer(request)
  if (!token) {
    return Response.json(
      { error: { code: "UNAUTHENTICATED", message: "Bearer token required." } },
      {
        headers: {
          ...corsHeaders,
          "www-authenticate": 'Bearer realm="Neram MCP"',
        },
        status: 401,
      }
    )
  }
  try {
    requireOrganizationClaims(token)
  } catch {
    return Response.json(
      {
        error: {
          code: "ORGANIZATION_REQUIRED",
          message: "Choose a Neram workspace and authorize MCP again.",
        },
      },
      {
        headers: {
          ...corsHeaders,
          "www-authenticate": 'Bearer realm="Neram MCP"',
        },
        status: 401,
      }
    )
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
