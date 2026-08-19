export type DocsNavItem = {
  title: string
  href: string
  description?: string
}

export type DocsNavGroup = {
  title: string
  items: DocsNavItem[]
}

export const docsNav: DocsNavGroup[] = [
  {
    title: "Getting Started",
    items: [
      {
        title: "Introduction",
        href: "/docs",
        description: "Neram in 5 minutes",
      },
      { title: "CLI", href: "/docs/cli", description: "neram CLI reference" },
      {
        title: "MCP",
        href: "/docs/mcp",
        description: "Model Context Protocol",
      },
    ],
  },
  {
    title: "Concepts",
    items: [
      {
        title: "Workspaces & Sprints",
        href: "/docs/concepts",
        description: "Organizations, projects, cadence",
      },
      {
        title: "Tasks & Board",
        href: "/docs/concepts#tasks",
        description: "Status, kanban, positions",
      },
    ],
  },
  {
    title: "Reference",
    items: [
      {
        title: "Error Codes",
        href: "/docs/reference",
        description: "Stable machine-readable errors",
      },
    ],
  },
]

export const allDocsHrefs = docsNav.flatMap((g) =>
  g.items.map((i) => i.href.split("#")[0])
)
