import { getCachedFullSiteText } from "@/lib/docs-text"

export const contentType = "text/plain; charset=utf-8"

export async function GET() {
  return new Response(await getCachedFullSiteText())
}
