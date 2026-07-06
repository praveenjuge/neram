import { ArrowLeft, Plug, Sparkles, Terminal } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { type CodeLang, highlightCode } from "@/lib/shiki"

export const metadata = {
  title: "Docs",
}

const setupCommands = `npx neram login          # Clerk OAuth (PKCE); tokens in OS keychain
                         # fallback: ~/.config/neram/credentials.json (chmod 600)
npx neram doctor --json  # config, auth, and MCP readiness
npx neram whoami --json  # identity + workspace totals
npx neram logout         # clear creds; best-effort revoke refresh token`

const whoamiExample = `{
  "ok": true,
  "user": { "name": "Ada Lovelace", "email": "ada@example.com" },
  "convexUrl": "https://your-team.convex.cloud",
  "workspace": {
    "projects": 8,
    "ownedProjects": 5,
    "sharedProjects": 3,
    "openTasks": 12
  },
  "mcp": {
    "stdio": "neram mcp",
    "hosted": "https://neram.praveenjuge.com/mcp"
  }
}`

const dailyCommands = `npx neram daily --json                    # compact execution digest
npx neram daily --project-limit 5 --json  # scan fewer projects
npx neram activity --limit 20 --json      # recent activity feed`

const taskCommands = `npx neram task list --project "Project name" --status inProgress
npx neram task add --project "Project name" --title "Follow up" --due 2026-02-01
npx neram task move --task-id TASK_ID --status inProgress
npx neram task done --task-id TASK_ID
npx neram task update --task-id TASK_ID --title "New title" --clear-assignee
npx neram task move-to --task-id TASK_ID --to-project "Other project"
npx neram task rm --task-id TASK_ID`

const projectCommands = `npx neram project list --json
npx neram project add --name "Project name" --icon rocket --color blue
npx neram project update --project "Project name" --name "Renamed"
npx neram project summary --project "Project name" --json
npx neram project check-in --project "Project name"
npx neram project rm --project-id PROJECT_ID   # id required; purges tasks`

const mcpStdioCommands = `npx neram login   # sign in first
npx neram mcp     # stdio server; refreshes the token per request

# print a client config without writing files (also: cursor, vscode)
npx neram mcp install claude-code`

const mcpConfig = `{
  "mcpServers": {
    "neram": {
      "command": "npx",
      "args": ["neram", "mcp"]
    }
  }
}`

const mcpHosted = `# hosted Streamable HTTP; send a Clerk id_token
curl -s https://neram.praveenjuge.com/mcp \\
  -H "Authorization: Bearer $NERAM_ID_TOKEN"`

const mcpTools = `# read-only
daily_brief
workspace_status
list_projects
list_tasks
summarize_project
recent_activity

# mutations
capture_task
update_task
move_task
complete_task
move_task_to_project
delete_task
check_in_project
create_project
update_project
delete_project          # destructive — purges every task`

const skillsReference = `skills/neram/SKILL.md   # teaches an agent to use Neram via CLI + MCP
                        # grouped as "Neram" in skills.sh.json (skills.sh)

# loads on demand for tasks like:
#   login / doctor / daily brief
#   create / move / complete tasks
#   check-in / summarize projects
#   script Neram from a shell or CI with --json
#   configure an MCP client (Claude, Codex, Cursor)`

const skillsCommands = `# pick "neram" from the list
npx skills add praveenjuge/neram

# or add it directly
npx skills add praveenjuge/neram -s neram

npx neram login   # sign in so the agent acts as your Neram user`

async function CodeBlock({
  children,
  label,
  lang,
}: {
  children: string
  label?: string
  lang: CodeLang
}) {
  const html = await highlightCode(children, lang)
  return (
    <div className="grid gap-1.5">
      {label ? (
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      ) : null}
      <div
        className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-sm leading-6"
        // Shiki output is generated server-side from static strings in this file.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function Prose({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="pt-1 text-sm font-medium text-foreground">{children}</h3>
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
            Agent surfaces for the Neram workspace: the npm CLI, the MCP tools,
            and the Neram agent skill. Agent and browser actions share the same
            signed-in Clerk identity.
          </p>
        </header>

        <Section icon={Terminal} title="CLI">
          <Prose>
            Package <code>neram</code>. Commands print human text by default;
            add <code>--json</code> for the exact, backward-compatible tool
            payload. Address tasks and projects by exact id (
            <code>--task-id</code>, <code>--project-id</code>) or by name.
          </Prose>

          <SubHeading>Sign in and check readiness</SubHeading>
          <CodeBlock lang="bash">{setupCommands}</CodeBlock>
          <CodeBlock label="neram whoami --json" lang="json">
            {whoamiExample}
          </CodeBlock>

          <SubHeading>Daily work</SubHeading>
          <CodeBlock lang="bash">{dailyCommands}</CodeBlock>

          <SubHeading>Tasks</SubHeading>
          <CodeBlock lang="bash">{taskCommands}</CodeBlock>

          <SubHeading>Projects</SubHeading>
          <CodeBlock lang="bash">{projectCommands}</CodeBlock>
        </Section>

        <Section icon={Plug} title="MCP">
          <Prose>
            Local stdio and hosted Streamable HTTP run the same tools, so agents
            get identical behavior either way.
          </Prose>

          <SubHeading>Local stdio</SubHeading>
          <CodeBlock lang="bash">{mcpStdioCommands}</CodeBlock>
          <CodeBlock label="MCP client config" lang="json">
            {mcpConfig}
          </CodeBlock>

          <SubHeading>Hosted Streamable HTTP</SubHeading>
          <CodeBlock lang="bash">{mcpHosted}</CodeBlock>

          <SubHeading>Tools</SubHeading>
          <CodeBlock lang="bash">{mcpTools}</CodeBlock>
        </Section>

        <Section icon={Sparkles} title="Skills">
          <Prose>
            The <code>neram</code> skill teaches an agent to use the CLI and MCP
            surfaces above instead of browser automation.
          </Prose>
          <CodeBlock lang="bash">{skillsReference}</CodeBlock>

          <SubHeading>Install into your agent</SubHeading>
          <Prose>
            The <code>skills</code> CLI detects your agents, asks for a scope,
            and writes the skill into <code>.claude/skills</code> or{" "}
            <code>.agents/skills</code>, tracking it in{" "}
            <code>skills-lock.json</code>.
          </Prose>
          <CodeBlock lang="bash">{skillsCommands}</CodeBlock>
        </Section>
      </div>
    </main>
  )
}
