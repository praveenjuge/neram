import { clerkMiddleware } from "@clerk/nextjs/server"

export default clerkMiddleware(
  () => {},
  {
    organizationSyncOptions: {
      organizationPatterns: ["/w/:slug", "/w/:slug/(.*)"],
    },
  }
)

export const config = {
  matcher: [
    "/((?!_next|mcp|api|\\.well-known|sw\\.js|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/__clerk/(.*)",
  ],
}
