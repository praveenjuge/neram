// Universal Links for the native Apple app (apps/apple). Workspace URLs under
// /w open in the app when it is installed. Apple's CDN fetches this file, so it
// must be served as JSON at this exact path with no redirect.
export function GET() {
  return Response.json(
    {
      applinks: {
        details: [
          {
            appIDs: ["LW385M78LW.com.praveenjuge.neram"],
            components: [{ "/": "/w" }, { "/": "/w/*" }],
          },
        ],
      },
    },
    { headers: { "cache-control": "public, max-age=3600" } }
  )
}
