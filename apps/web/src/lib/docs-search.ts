// Zero-JS server search index — used by /docs/search and drift guard.
// Keep in sync with actual docs/*. Keep description concise for server rendering.

export type SearchDoc = {
  href: string
  title: string
  excerpt: string
  keywords: string[]
}

export const searchIndex: SearchDoc[] = [
  {
    href: "/docs",
    title: "Introduction — Neram",
    excerpt:
      "Quiet, organization-wide Sprints for teams and agents. CLI + MCP share the same Clerk identity.",
    keywords: [
      "neram",
      "intro",
      "sprint",
      "workspace",
      "organization",
      "quickstart",
      "login",
    ],
  },
  {
    href: "/docs/cli",
    title: "CLI Reference",
    excerpt:
      "neram login, doctor, whoami, daily, task, project, workspace, sprint. Every command supports --json.",
    keywords: [
      "cli",
      "npx neram",
      "login",
      "doctor",
      "whoami",
      "daily",
      "task",
      "project",
      "workspace",
      "sprint",
      "json",
    ],
  },
  {
    href: "/docs/mcp",
    title: "MCP — Model Context Protocol",
    excerpt:
      "Local stdio and hosted Streamable HTTP. Same Organization-scoped tools, stable error codes, Bearer id_token.",
    keywords: [
      "mcp",
      "stdio",
      "http",
      "streamable",
      "bearer",
      "token",
      "claude",
      "cursor",
      "codex",
      "tools",
      "daily_brief",
    ],
  },
  {
    href: "/docs/concepts",
    title: "Concepts — Workspaces & Sprints",
    excerpt:
      "Clerk Organizations are the tenant boundary. Sprints provide Current/Upcoming cadence across all projects.",
    keywords: [
      "workspace",
      "organization",
      "sprint",
      "cadence",
      "project",
      "kanban",
      "task",
      "status",
      "position",
    ],
  },
  {
    href: "/docs/reference",
    title: "Reference — Error Codes",
    excerpt:
      "UNAUTHENTICATED, MISSING_CONFIG, AMBIGUOUS, NOT_FOUND, FORBIDDEN, ORGANIZATION_REQUIRED, etc.",
    keywords: [
      "error",
      "UNAUTHENTICATED",
      "AMBIGUOUS",
      "NOT_FOUND",
      "FORBIDDEN",
      "VALIDATION",
      "code",
    ],
  },
]

export function searchDocs(query: string): SearchDoc[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return searchIndex.filter((doc) => {
    const hay =
      `${doc.title} ${doc.excerpt} ${doc.keywords.join(" ")}`.toLowerCase()
    return hay.includes(q)
  })
}
