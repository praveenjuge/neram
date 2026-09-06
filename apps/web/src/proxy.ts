import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isLanding = createRouteMatcher(["/"])

export default clerkMiddleware(async (auth, request) => {
  // Redirect signed-in visitors from marketing landing to workspace picker.
  // Keeps `/` fully static (no auth() in page) while preserving
  // neram.praveenjuge.com -> workspace auto-redirect when signed in.
  if (isLanding(request)) {
    const { userId } = await auth()
    if (userId) {
      return NextResponse.redirect(new URL("/w", request.url))
    }
  }
}, {
  organizationSyncOptions: {
    organizationPatterns: ["/w/:slug", "/w/:slug/(.*)"],
  },
})

export const config = {
  matcher: ["/", "/w", "/w/:path*", "/__clerk/(.*)"],
}
