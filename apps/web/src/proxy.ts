import { clerkMiddleware } from "@clerk/nextjs/server"

export default clerkMiddleware(() => {}, {
  organizationSyncOptions: {
    organizationPatterns: ["/w/:slug", "/w/:slug/(.*)"],
  },
})

export const config = {
  matcher: ["/", "/w", "/w/:path*", "/__clerk/(.*)"],
}
