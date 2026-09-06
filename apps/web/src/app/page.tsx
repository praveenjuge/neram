import {
  History,
  IterationCcw,
  Kanban,
  Plug,
  Terminal,
  Users,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { CodeBlock } from "@/components/code-block"
import { CopyCommand } from "@/components/copy-command"
import { SiteFooter } from "@/components/site-footer"
import { SITE_URL, homeOptions } from "@/lib/layout.shared"
import { HomeLayout } from "fumadocs-ui/layouts/home"

export const metadata: Metadata = {
  title: "Neram — A quieter way to focus",
  description:
    "Projects hold all work. One optional Sprint keeps humans and agents focused on what matters now.",
  alternates: {
    canonical: SITE_URL,
  },
}

const mcpOneLiner = "npx neram login && npx neram mcp"
const heroSnippet = `npx neram daily --json
npx neram task add --project "Website" --title "Ship pricing" --json
npx neram sprint plan --task-id TASK_ID`

const features = [
  {
    icon: IterationCcw,
    title: "One focus across projects",
    desc: "Projects hold all work. An optional Sprint shows only what the team is focusing on now.",
  },
  {
    icon: Plug,
    title: "Same tools, two transports",
    desc: "Local stdio for dev, hosted HTTP with Clerk id_token for CI. Stable error codes either way.",
  },
  {
    icon: Terminal,
    title: "Scriptable by design",
    desc: "Every command has --json. Pipe to jq, run in CI, or let your agent call it directly.",
  },
  {
    icon: Kanban,
    title: "Kanban without theater",
    desc: "todo → inProgress → done with optional position, assignee, due date, and Sprint.",
  },
  {
    icon: Users,
    title: "Clerk workspaces",
    desc: "Organizations are the tenant. Roles, members, and switching are Clerk-native.",
  },
  {
    icon: History,
    title: "Simple Sprint memory",
    desc: "History keeps the committed and completed counts; unfinished work returns to Backlog.",
  },
]

const steps = [
  {
    n: "01",
    title: "Connect your workspace",
    body: "neram login opens Clerk OAuth (PKCE). Pick an Organization — that’s your tenant. Tokens go to OS keychain, fallback to 0600 file.",
  },
  {
    n: "02",
    title: "Plan the Sprint",
    body: "Start an optional 1, 2, or 4 week Sprint—or leave it open-ended—then choose a few Backlog tasks.",
  },
  {
    n: "03",
    title: "Let agents execute",
    body: "Agents call daily_brief, capture_task, move_task, complete_task via MCP — same identity you use in the browser.",
  },
]

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Neram",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web, macOS, Linux, iOS",
  url: SITE_URL,
  description:
    "Projects hold all work. One optional Sprint keeps humans and agents focused on what matters now.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  license: "https://github.com/praveenjuge/neram/blob/main/LICENSE",
}

// Static landing: signed-in redirect to `/w` is handled in `src/proxy.ts`
// middleware so this page prerenders and serves from CDN.
export default function HomePage() {
  return (
    <HomeLayout {...homeOptions()}>
      <main className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025] dark:opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pt-10 pb-8 md:pt-14 md:pb-10">
          <div className="mx-auto flex max-w-[680px] flex-col items-center text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[11px] tracking-wide text-muted-foreground">
              <span className="size-1.5 rounded-full bg-foreground" />
              MIT · Free hosted
            </div>

            <h1 className="mt-3.5 font-display text-[34px] leading-[0.92] font-medium tracking-[-0.035em] md:text-[52px]">
              Work that stays
              <br />
              <span className="font-light tracking-[-0.04em] text-muted-foreground/80">
                where agents can find it.
              </span>
            </h1>

            <p className="mt-3.5 max-w-[48ch] text-[15px] leading-7 text-muted-foreground/90">
              Neram keeps projects calm and durable, with one optional Sprint for
              what matters now and the same context for people and agents.
            </p>

            <div className="mt-6 w-full max-w-[420px]">
              <CopyCommand command={mcpOneLiner} />
            </div>
          </div>

          <div className="mx-auto mt-8 w-full max-w-[560px]">
            <CodeBlock code={heroSnippet} lang="bash" />
            <p className="mt-2.5 text-center text-xs text-muted-foreground/70">
              Copy, run, and your agent has the same Sprint context you do.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-5 py-7">
          <div className="grid gap-x-8 gap-y-7 border-t pt-7 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="flex gap-3">
                <f.icon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  size={16}
                />
                <div className="space-y-1">
                  <h3 className="text-sm font-medium leading-none">{f.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-5 py-7">
          <div className="border-t pt-7">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              How it works
            </h2>
            <div className="mt-5 grid gap-6 md:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="space-y-2">
                  <div className="font-mono text-xs text-muted-foreground">
                    {s.n}
                  </div>
                  <div className="text-sm font-medium">{s.title}</div>
                  <p className="text-sm leading-6 text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-10">
          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-6">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                Quiet commitments, now with an agent handle.
              </div>
              <div className="text-sm text-muted-foreground">
                Start with docs, or peek at the GitHub.
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                className="inline-flex h-8 items-center rounded-full bg-foreground px-3 text-sm font-medium text-background transition hover:opacity-90"
                href="/docs"
              >
                Read docs
              </Link>
              <a
                className="inline-flex h-8 items-center rounded-full border border-border px-3 text-sm transition hover:bg-muted"
                href="https://accounts.neram.praveenjuge.com/sign-in?redirect_url=https%3A%2F%2Fneram.praveenjuge.com%2Fw"
              >
                Sign in
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
    </HomeLayout>
  )
}
