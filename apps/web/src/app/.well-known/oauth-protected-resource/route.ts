const corsHeaders = {
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=3600",
}

// RFC 9728 OAuth 2.0 Protected Resource Metadata for the Neram MCP server.
// Advertised via WWW-Authenticate: Bearer resource_metadata="...".
export function GET() {
  return Response.json(
    {
      resource: "https://neram.praveenjuge.com/mcp",
      authorization_servers: ["https://clerk.neram.praveenjuge.com"],
      bearer_methods_supported: ["header"],
      scopes_supported: [
        "workspace:read",
        "workspace:write",
        "sprint:manage",
        "admin",
      ],
      resource_documentation: "https://neram.praveenjuge.com/docs/mcp",
    },
    { headers: corsHeaders }
  )
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders, status: 204 })
}
