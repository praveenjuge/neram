import { connection } from "next/server"

const corsHeaders = {
  "access-control-allow-origin": "*",
}

function envValue(value: string | undefined) {
  if (!value) return undefined
  const trimmed = value.trim().replace(/^"(.*)"$/, "$1")
  return trimmed.length > 0 ? trimmed : undefined
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders, status: 204 })
}

export async function GET() {
  await connection()

  const body = {
    clerkFrontendApiUrl: envValue(
      process.env.NERAM_CLERK_FRONTEND_API_URL ??
        process.env.CLERK_FRONTEND_API_URL
    ),
    convexUrl: envValue(
      process.env.NERAM_CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL,
    ),
    oauthClientId: envValue(process.env.NERAM_CLERK_OAUTH_CLIENT_ID),
  }

  if (!body.convexUrl || !body.clerkFrontendApiUrl || !body.oauthClientId) {
    return Response.json(
      { error: "Neram agent config is incomplete." },
      { headers: corsHeaders, status: 500 }
    )
  }

  return Response.json(body, {
    headers: {
      ...corsHeaders,
      "cache-control": "public, max-age=300",
    },
  })
}
