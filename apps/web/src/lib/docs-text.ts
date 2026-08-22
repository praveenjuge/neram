import { SITE_URL } from "@/lib/layout.shared"
import { source } from "@/lib/source"

type DocsPage = ReturnType<typeof source.getPages>[number]

/** Sidebar order (meta.json) hides legal pages from navigation, but they must
 * still appear in agent-facing text outputs. Keep the canonical order here. */
const PAGE_ORDER = [
  "index",
  "cli",
  "mcp",
  "concepts",
  "reference",
  "privacy",
  "terms",
]

function slugOf(page: DocsPage) {
  return page.slugs.length ? page.slugs.join("/") : "index"
}

function orderedPages() {
  const pages = [...source.getPages()]
  pages.sort((a, b) => {
    const ai = PAGE_ORDER.indexOf(slugOf(a))
    const bi = PAGE_ORDER.indexOf(slugOf(b))
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  return pages
}

function stripFrontmatter(raw: string) {
  if (!raw.startsWith("---")) return raw
  const end = raw.indexOf("\n---", 3)
  return end === -1 ? raw : raw.slice(end + 4).replace(/^\n+/, "")
}

async function pageMarkdown(page: DocsPage) {
  const raw = await page.data.getText("raw")
  return `# ${page.data.title}\nSource: ${SITE_URL}${page.url}\n\n${stripFrontmatter(raw)}`
}

function buildSiteIndex() {
  const header = [
    "# Neram",
    "",
    "> Projects hold all work. One optional Sprint keeps humans and agents focused on what matters now.",
    "",
  ]
  const items = orderedPages().map(
    (p) =>
      `- [${p.data.title}](${SITE_URL}${p.url}): ${p.data.description ?? ""}`
  )
  return [...header, ...items].join("\n") + "\n"
}

/** `llms.txt`-style index of the whole site, prerendered at build time. */
export async function getCachedSiteIndex(): Promise<string> {
  "use cache"
  return buildSiteIndex()
}

/** Full site content for LLM consumption, prerendered at build time. */
export async function getCachedFullSiteText(): Promise<string> {
  "use cache"
  const parts = [buildSiteIndex()]
  for (const page of orderedPages()) {
    parts.push("\n" + (await pageMarkdown(page)))
  }
  return parts.join("\n")
}

/** Raw `.md`/`.mdx` source of a single docs page, prerendered at build time. */
export async function getCachedDocsPageSource(
  slugKey: string,
  format: "md" | "mdx"
): Promise<string | null> {
  "use cache"
  const slug = slugKey === "" || slugKey === "index" ? [] : slugKey.split("/")
  const page = source.getPage(slug)
  if (!page) return null

  // The MDX dump keeps the original file bytes; the markdown dump drops the
  // frontmatter so the body reads standalone.
  const raw = await page.data.getText("raw")
  return format === "mdx" ? raw : stripFrontmatter(raw)
}
