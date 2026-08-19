import Link from "next/link"
import type { Metadata } from "next"

import { CodeBlock, H1, H2, H3, Lead, Prose } from "./components"

export const metadata: Metadata = {
  title: "Introduction",
  description:
    "Neram in 5 minutes — quiet Sprints for teams and coding agents.",
}

const quickstart = `npx neram login          # Clerk OAuth (PKCE); choose an Organization
npx neram doctor --json  # config, auth, and MCP readiness
npx neram whoami --json  # identity + active Organization + workspace totals
npx neram daily --json   # compact execution digest`

export default function DocsIndexPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="space-y-3">
        <H1>Introduction</H1>
        <Lead>
          Neram is a project and task workspace where Clerk Organizations are
          the canonical tenant and Sprints provide a recurring Current/Upcoming
          cadence across every project. Browser, CLI, and MCP share the same
          identity and Sprint engine.
        </Lead>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          className="inline-flex h-7 items-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          href="/docs/cli"
        >
          CLI reference
        </Link>
        <Link
          className="inline-flex h-7 items-center rounded-full border px-3 text-sm hover:bg-muted"
          href="/docs/mcp"
        >
          MCP reference
        </Link>
      </div>

      <H2>Quickstart</H2>
      <div className="mt-3 grid gap-3">
        <CodeBlock lang="bash">{quickstart}</CodeBlock>
        <Prose>
          <code>neram login</code> opens the browser, returns to a loopback{" "}
          <code>127.0.0.1</code> callback, and stores the Organization-bound
          token in the OS keychain with a <code>chmod 600</code> fallback at{" "}
          <code>~/.config/neram/credentials.json</code>. Switching workspaces
          reruns OAuth and requires MCP reconnection.
        </Prose>
      </div>

      <H2>What is a Sprint?</H2>
      <Prose>
        A Sprint is an organization-wide timebox, not per-project. You choose
        weeks (e.g., 2), start weekday, and timezone. Tasks can be planned into{" "}
        <code>backlog</code>, <code>current</code>, or <code>upcoming</code>.
        Rollover archives the Sprint and carries the history.
      </Prose>

      <H2>Three surfaces, one model</H2>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border p-4">
          <div className="text-sm font-medium">Web</div>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Kanban board, Sprint board, task detail.
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-sm font-medium">CLI</div>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            <code>neram</code> on npm. Human text by default,{" "}
            <code>--json</code> for agents.
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-sm font-medium">MCP</div>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Local stdio or hosted HTTP. Same tools, same auth.
          </p>
        </div>
      </div>

      <H2>Next</H2>
      <ul className="mt-3 grid gap-2 text-sm">
        <li>
          <Link
            className="underline underline-offset-4 hover:text-foreground"
            href="/docs/cli"
          >
            CLI → install, daily work, sprints, tasks
          </Link>
        </li>
        <li>
          <Link
            className="underline underline-offset-4 hover:text-foreground"
            href="/docs/mcp"
          >
            MCP → stdio vs HTTP, tool list
          </Link>
        </li>
        <li>
          <Link
            className="underline underline-offset-4 hover:text-foreground"
            href="/docs/concepts"
          >
            Concepts → workspaces, Sprints, task model
          </Link>
        </li>
      </ul>

      <H3>Config</H3>
      <Prose>
        CLI loads public config from <code>/.well-known/neram-agent.json</code>.
        Override only for local dev with <code>NERAM_CONVEX_URL</code>,{" "}
        <code>NERAM_CLERK_FRONTEND_API_URL</code>,{" "}
        <code>NERAM_CLERK_OAUTH_CLIENT_ID</code>.
      </Prose>
    </div>
  )
}
