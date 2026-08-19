import type { Metadata } from "next"

import { CodeBlock, H1, H2, H3, Lead, Prose } from "../components"

export const metadata: Metadata = {
  title: "CLI",
  description: "Neram CLI reference — login, daily, tasks, projects, sprints.",
}

const setup = `npx neram login          # Clerk OAuth (PKCE); choose an Organization
# fallback: ~/.config/neram/credentials.json (chmod 600)
npx neram doctor --json  # config, auth, and MCP readiness
npx neram whoami --json  # identity + active Organization + workspace totals
npx neram logout         # clear creds; best-effort revoke refresh token`

const daily = `npx neram daily --json                    # compact execution digest
npx neram brief --project-limit 5 --json  # alias for daily
npx neram activity --limit 20 --json      # recent activity feed`

const tasks = `npx neram task list --project "Project name" --status inProgress
npx neram task add --project "Project name" --title "Follow up" --due 2026-02-01 --sprint backlog
npx neram task move --task-id TASK_ID --status inProgress
npx neram task move --task-id TASK_ID --status inProgress --position 1.5  # kanban order
npx neram task done --task-id TASK_ID
npx neram task update --task-id TASK_ID --title "New title" --clear-assignee
npx neram task update --project "Project name" --task-title "Old title" --title "New title"
npx neram task move-to --task-id TASK_ID --to-project "Other project"
npx neram task rm --task-id TASK_ID`

const projects = `npx neram project list --json
npx neram project add --name "Project name" --icon rocket --color blue
npx neram project update --project "Project name" --name "Renamed"
npx neram project summary --project "Project name" --json
npx neram project rm --project-id PROJECT_ID   # id required; purges tasks`

const workspaces = `npx neram workspace current --json
npx neram workspace create --name "Acme" --slug acme
npx neram workspace switch              # rerun OAuth, then reconnect MCP
npx neram workspace members --json
npx neram workspace invite --email member@example.com --role org:member
npx neram workspace role --user-id USER_ID --role org:admin
npx neram workspace remove-member --user-id USER_ID --organization-id ORG_ID --organization-slug SLUG --confirm
npx neram workspace delete --organization-id ORG_ID --organization-slug SLUG --confirm`

const sprints = `npx neram sprint current --json          # also: backlog, upcoming
npx neram sprint history [--sprint-id SPRINT_ID] --limit 20 --json
npx neram sprint plan --task-id TASK_ID --sprint upcoming
npx neram sprint remove --task-id TASK_ID --sprint current
npx neram sprint goal --sprint current --goal "Ship the cutover"
npx neram sprint cadence --weeks 2 --start-weekday 1 --timezone Asia/Kolkata
npx neram sprint rollover --reason "Customer deadline" --organization-id ORG_ID --organization-slug SLUG --confirm`

const whoami = `{
  "ok": true,
  "identity": { "name": "Ada Lovelace", "email": "ada@example.com" },
  "organization": {
    "organizationId": "org_123",
    "slug": "acme",
    "name": "Acme",
    "role": "org:admin"
  },
  "workspace": {
    "projects": 8,
    "openTasks": 12
  }
}`

export default function CliPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <H1>CLI</H1>
      <Lead>
        Package <code>neram</code> on npm. Commands print human text by default;
        add <code>--json</code> for the exact, backward-compatible payload.
        Prefer ids (<code>--task-id</code>, <code>--project-id</code>) for
        automation.
      </Lead>

      <H2>Sign in and check readiness</H2>
      <div className="mt-3 grid gap-3">
        <CodeBlock lang="bash">{setup}</CodeBlock>
        <CodeBlock label="neram whoami --json" lang="json">
          {whoami}
        </CodeBlock>
        <Prose>
          Use <code>--project-id</code> for exact ids. <code>--project</code>{" "}
          only when the name is unambiguous; the CLI rejects ambiguous matches
          with <code>AMBIGUOUS</code> and <code>details.matches</code>.
        </Prose>
      </div>

      <H2>Daily work</H2>
      <CodeBlock lang="bash">{daily}</CodeBlock>

      <H2>Tasks</H2>
      <CodeBlock lang="bash">{tasks}</CodeBlock>

      <H2>Projects</H2>
      <CodeBlock lang="bash">{projects}</CodeBlock>

      <H2>Workspaces (Clerk Organizations)</H2>
      <Prose>
        Clerk Organizations are the workspace boundary. Switching replaces the
        stored token; reconnect MCP afterward.
      </Prose>
      <div className="mt-3">
        <CodeBlock lang="bash">{workspaces}</CodeBlock>
      </div>

      <H2>Sprints</H2>
      <CodeBlock lang="bash">{sprints}</CodeBlock>

      <H3>Notes</H3>
      <Prose>
        <code>neram task move</code> accepts an optional <code>--position</code>{" "}
        for kanban order. Sprints are organization-wide — planning one project
        also respects the same Current/Upcoming.
      </Prose>
    </div>
  )
}
