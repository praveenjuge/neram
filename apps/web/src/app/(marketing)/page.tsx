import {
  History,
  IterationCcw,
  Kanban,
  Plug,
  Terminal,
  Users,
} from "lucide-react"
import Link from "next/link"
import type { Metadata } from "next"

import { Button } from "@/components/ui/button"
import { highlightCode } from "@/lib/shiki"

import { CopyCommand } from "./copy-command"

export const metadata: Metadata = {
  title: "Neram — A quiet cadence for shared work",
  description:
    "A calm, shared board — org-wide projects, a recurring Sprint with memory, and the same commitments for humans and agents.",
  alternates: { canonical: "https://neram.praveenjuge.com/" },
}

const mcpOneLiner = `npx neram login && npx neram mcp`
const heroSnippet = `npx neram daily --json
npx neram task add --project "Website" --title "Ship pricing" --json
npx neram sprint plan --task-id TASK_ID --sprint upcoming`

async function HeroCode() {
  const html = await highlightCode(heroSnippet, "bash")
  return (
    <div
      className="overflow-hidden rounded-md bg-transparent px-1 py-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function GridPattern() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025] dark:opacity-[0.04]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
        backgroundSize: "32px 32px",
      }}
    />
  )
}

export default async function MarketingPage() {
  return (
    <main className="relative overflow-hidden">
      <GridPattern />

      {/* Hero — centered, minimal, tasteful */}
      <section className="mx-auto max-w-6xl px-5 pt-10 pb-8 md:pt-14 md:pb-10">
        <div className="mx-auto flex max-w-[680px] flex-col items-center text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-[11px] tracking-wide text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            MIT · Free hosted
          </div>

          <h1 className="mt-3.5 font-heading text-[34px] leading-[0.92] font-[520] tracking-[-0.035em] md:text-[52px]">
            Work that stays
            <br />
            <span className="font-[320] tracking-[-0.04em] text-muted-foreground/80">
              where agents can find it.
            </span>
          </h1>

          <p className="mt-3.5 max-w-[48ch] text-[15px] leading-7 text-muted-foreground/90">
            Neram is a quiet cadence, not a noisy feed — projects across your
            org, Sprints that remember carryover, and a calm board both hands
            and agents can move.
          </p>

          <div className="mt-6 w-full max-w-[420px]">
            <CopyCommand command={mcpOneLiner} />
          </div>
        </div>

        <div className="mx-auto mt-8 w-full max-w-[560px]">
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
            <div className="flex items-center gap-1.5 border-b border-border/50 bg-muted/20 px-3.5 py-2">
              <span className="size-2.5 rounded-full border border-border bg-muted" />
              <span className="size-2.5 rounded-full border border-border bg-muted" />
              <span className="size-2.5 rounded-full border border-border bg-muted" />
              <span className="ml-2 font-mono text-[11px] tracking-wide text-muted-foreground">
                neram — agent session
              </span>
            </div>
            <div className="bg-muted/[0.015] px-2 py-2">
              <HeroCode />
            </div>
          </div>
          <p className="mt-2.5 text-center text-xs text-muted-foreground/70">
            Copy, run, and your agent has the same Sprint context you do.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-7">
        <div className="grid gap-x-8 gap-y-7 border-t pt-7 md:grid-cols-3">
          {[
            {
              icon: IterationCcw,
              title: "One cadence across projects",
              desc: "Sprints are org-wide. Weeks, start weekday, timezone — carryover and history stay consistent.",
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
              title: "Commitment & carryover",
              desc: "daily_brief and sprint history keep commitments and carryover auditable.",
            },
          ].map((f) => (
            <div className="flex gap-3" key={f.title}>
              <f.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <h3 className="text-sm leading-none font-medium">{f.title}</h3>
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
          <h2 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            How it works
          </h2>
          <div className="mt-5 grid gap-6 md:grid-cols-3">
            {[
              {
                n: "01",
                title: "Connect your workspace",
                body: "neram login opens Clerk OAuth (PKCE). Pick an Organization — that’s your tenant. Tokens go to OS keychain, fallback to 0600 file.",
              },
              {
                n: "02",
                title: "Plan the Sprint",
                body: "Set cadence (2 weeks, Monday, Asia/Kolkata), add goals, then plan tasks into current or upcoming from CLI or board.",
              },
              {
                n: "03",
                title: "Let agents execute",
                body: "Agents call daily_brief, capture_task, move_task, complete_task via MCP — same identity you use in the browser.",
              },
            ].map((s) => (
              <div className="space-y-2" key={s.n}>
                <div className="font-mono text-xs text-muted-foreground">
                  {s.n}
                </div>
                <div className="text-sm font-medium">{s.title}</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {s.body}
                </p>
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
            <Button asChild size="sm">
              <Link href="/docs">Read docs</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
