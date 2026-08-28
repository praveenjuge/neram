import Link from "next/link"

import { SITE_URL } from "@/lib/layout.shared"

const recoveryTargets = [
  { href: "/", label: "Home", description: "overview and getting started" },
  {
    href: "/docs",
    label: "Documentation",
    agentLabel: "Docs",
    description: "CLI, MCP, concepts and reference",
  },
  {
    href: "/sitemap.xml",
    label: "Sitemap",
    description: "all indexed pages",
  },
  {
    href: "/llms.txt",
    label: "llms.txt",
    agentLabel: "Site index",
    description: "site index for agents",
  },
  {
    href: "/llms-full.txt",
    label: "llms-full.txt",
    agentLabel: "Full dump",
    description: "full documentation dump",
  },
  { href: "/robots.txt", label: "robots.txt", agentLabel: "Robots" },
] as const

const agentRecoveryText = `# 404 — Not Found (${new URL(SITE_URL).host})

This path does not exist.

Try:
${recoveryTargets
  .map(
    ({ href, label, ...target }) =>
      `- ${"agentLabel" in target ? target.agentLabel : label}: ${SITE_URL}${href}`
  )
  .join("\n")}
`

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 p-6 text-sm">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          404 — Page not found
        </h1>
        <p className="mt-2 leading-6 text-muted-foreground">
          That page does not exist. You may have followed an outdated link or
          mistyped a URL. The site map and agent index below will get you back
          on track.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold">Where to go next</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
          {recoveryTargets.map(({ href, label, ...target }) => (
            <li key={href}>
              <Link href={href} className="underline underline-offset-4">
                {label}
              </Link>
              {"description" in target && <> — {target.description}</>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Recovery for agents</h2>
        <pre className="mt-2 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-5">
          {agentRecoveryText}
        </pre>
      </section>

      <p className="text-xs text-muted-foreground">
        If you arrived here from an external link, please let us know via{" "}
        <a
          href="https://github.com/praveenjuge/neram/issues"
          className="underline underline-offset-4"
        >
          GitHub issues
        </a>
        .
      </p>
    </main>
  )
}
