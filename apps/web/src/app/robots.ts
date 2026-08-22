import type { MetadataRoute } from "next"

import { SITE_URL } from "@/lib/layout.shared"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/w/", "/api/", "/mcp"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
