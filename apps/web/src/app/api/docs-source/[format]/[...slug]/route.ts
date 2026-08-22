import { getCachedDocsPageSource } from "@/lib/docs-text"
import { source } from "@/lib/source"

export const contentType = "text/markdown; charset=utf-8"

/** Seed every page × format combination at build time so requests never read
 * from the filesystem at runtime. */
export function generateStaticParams() {
  const formats = ["md", "mdx"] as const
  return source.getPages().flatMap((page) =>
    formats.map((format) => ({
      format,
      // the docs index file has no slugs; expose it under /docs/index.*
      slug: page.slugs.length ? page.slugs : ["index"],
    }))
  )
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ format: string; slug: string[] }> }
) {
  const { format, slug } = await params
  if (format !== "md" && format !== "mdx") {
    return new Response("Not found", { status: 404 })
  }

  const body = await getCachedDocsPageSource(slug.join("/"), format)
  if (body === null) {
    return new Response("Not found", { status: 404 })
  }
  return new Response(body)
}
