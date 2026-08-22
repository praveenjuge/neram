import { getCachedDocsPageSource } from "@/lib/docs-text"

export const contentType = "text/markdown; charset=utf-8"

export async function GET() {
  const body = await getCachedDocsPageSource("", "md")
  if (body === null) {
    return new Response("Not found", { status: 404 })
  }
  return new Response(body)
}
