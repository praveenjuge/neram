import type { MetadataRoute } from "next"

import { SITE_URL } from "@/lib/layout.shared"
import { source } from "@/lib/source"

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = source.getPages().map((page) => ({
    url: `${SITE_URL}${page.url}`,
    lastModified: new Date(),
  }))

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
    },
    ...pages,
  ]
}
