import { ArrowLeft, Box, ClipboardCheck, Plug, Terminal } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Docs",
}

const cliCommands = [
  "npx neram login",
  "npx neram whoami",
  "npx neram doctor --json",
  "npx neram daily --json",
  "npx neram task add --project \"Project name\" --title \"Follow up\" --json",
  "npx neram task move --task-id TASK_ID --status inProgress --json",
  "npx neram task done --task-id TASK_ID --json",
  "npx neram project check-in --project \"Project name\" --json",
  "npx neram project summary --project \"Project name\" --json",
]

const mcpTools = [
  "daily_brief",
  "capture_task",
  "move_task",
  "complete_task",
  "check_in_project",
  "summarize_project",
  "workspace_status",
]

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-sm leading-6">
      <code>{children}</code>
    </pre>
  )
}

function Section({
  children,
  icon: Icon,
  title,
}: {
  children: ReactNode
  icon: typeof Terminal
  title: string
}) {
  return (
    <section className="grid gap-3 border-t py-7">
      <h2 className="flex items-center gap-2 font-heading text-lg font-medium">
        <Icon className="size-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function DocsPage() {
  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto grid w-full max-w-4xl gap-6 px-5 py-6">
        <Button asChild className="w-fit" size="sm" variant="ghost">
          <Link href="/">
            <ArrowLeft /> Back
          </Link>
        </Button>
        <header className="grid gap-3">
          <h1 className="font-heading text-2xl font-medium tracking-normal">
            Neram Docs
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Neram is a Clerk and Convex workspace for projects, tasks, shared
            boards, personal recency, activity, an npm CLI, and MCP tools for AI
            agents.
          </p>
        </header>

        <Section icon={Box} title="App">
          <p className="text-sm leading-6 text-muted-foreground">
            The web app keeps projects, assigned tasks, activity, invite-based
            collaboration, due dates, and kanban status in one authenticated
            workspace. Convex enforces access from the signed-in Clerk user, so
            agent actions and browser actions share the same identity.
          </p>
        </Section>

        <Section icon={Terminal} title="CLI">
          <p className="text-sm leading-6 text-muted-foreground">
            The public npm package is `neram`. `login`, `logout`, and `whoami`
            print quiet, human-friendly output by default; add `--json` for
            stable, machine-readable output in scripts and CI.
          </p>
          <CodeBlock>{cliCommands.join("\n")}</CodeBlock>
        </Section>

        <Section icon={Plug} title="MCP">
          <p className="text-sm leading-6 text-muted-foreground">
            Local agents can run stdio with `npx neram mcp`. It fails fast with
            a friendly message when you aren't logged in, so run `npx neram
            login` first. Hosted agents can call Streamable HTTP at
            `https://neram.praveenjuge.com/mcp` with a Clerk OAuth `id_token`
            bearer token.
          </p>
          <CodeBlock>{`{
  "mcpServers": {
    "neram": {
      "command": "npx",
      "args": ["neram", "mcp"]
    }
  }
}`}</CodeBlock>
          <p className="text-sm leading-6 text-muted-foreground">
            Tools: {mcpTools.join(", ")}.
          </p>
        </Section>

        <Section icon={ClipboardCheck} title="Publishing">
          <p className="text-sm leading-6 text-muted-foreground">
            CLI releases publish to npm when `apps/agent/package.json` contains
            a new version on `main`. GitHub Actions builds, tests, typechecks,
            and publishes with npm provenance.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Agent skills live in `skills/neram-cli` and `skills/neram-mcp`, with
            `skills.sh.json` grouping them for skills.sh discovery.
          </p>
        </Section>
      </div>
    </main>
  )
}
