import type { Metadata } from "next"

import { CodeBlock, H1, H2, H3, Lead, Prose } from "../components"

export const metadata: Metadata = {
  title: "Concepts",
  description: "Neram concepts — workspaces, Sprints, projects, tasks.",
}

const cadence = `npx neram sprint cadence --weeks 2 --start-weekday 1 --timezone Asia/Kolkata
npx neram sprint goal --sprint current --goal "Ship the cutover"
npx neram sprint current --json`

const board = `npx neram task move --task-id TASK_ID --status inProgress --position 1.5
npx neram task move --task-id TASK_ID --status done
# status: todo | inProgress | done
# position: fractional kanban order; omit to append`

export default function ConceptsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <H1>Concepts</H1>
      <Lead>
        How Neram models work: Organizations as tenants, Sprints as a recurring
        cadence, and a kanban board that stays in sync across web, CLI, and MCP.
      </Lead>

      <H2>Workspaces</H2>
      <Prose>
        A workspace is a Clerk Organization. Every project, task, and Sprint
        belongs to one Organization. Members are Clerk users with roles{" "}
        <code>org:admin</code> or <code>org:member</code>. Switching workspaces
        reruns OAuth and replaces the stored token — reconnect local or hosted
        MCP afterward.
      </Prose>
      <div className="mt-3 rounded-xl border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
        Canon: organization id + slug must both match for destructive operations
        (<code>remove-member</code>, <code>delete_workspace</code>,{" "}
        <code>rollover_sprint</code>). The confirmation prevents cross-org
        mistakes.
      </div>

      <H2>Sprints</H2>
      <Prose>
        Sprints are organization-wide, not per-project. They have{" "}
        <code>backlog</code>, <code>current</code>, and <code>upcoming</code>.
        The cadence (weeks + start weekday + timezone) controls when a new
        Sprint begins.
      </Prose>
      <div className="mt-3 grid gap-3">
        <CodeBlock lang="bash">{cadence}</CodeBlock>
        <Prose>
          Use <code>sprint plan</code> and <code>sprint remove</code> to assign
          tasks to a Sprint. <code>sprint history</code> shows commitment and
          carryover. <code>rollover</code> is destructive and requires exact
          Organization confirmation.
        </Prose>
      </div>

      <H2 id="tasks">Tasks &amp; Board</H2>
      <Prose>
        Tasks belong to a project. They have <code>title</code>, optional{" "}
        <code>description</code>, <code>status</code> (<code>todo</code> /{" "}
        <code>inProgress</code> / <code>done</code>), <code>assignee</code>,{" "}
        <code>dueDate</code>, <code>sprint</code>, and kanban{" "}
        <code>position</code>. Moving a task between projects or statuses
        preserves identity; deleting is hard-delete.
      </Prose>
      <div className="mt-3">
        <CodeBlock lang="bash">{board}</CodeBlock>
      </div>

      <H3>Projects</H3>
      <Prose>
        Projects have <code>name</code>, <code>icon</code>, <code>color</code>,
        and role-aware archived state. Agents can call{" "}
        <code>summarize_project</code> to get compact LLM context: project +
        sampled tasks.
      </Prose>

      <H3>Daily brief</H3>
      <Prose>
        <code>daily_brief</code> (CLI: <code>neram daily --json</code>) returns
        a compact digest: totals, Sprint goals, overdue, and recent activity.
        It&apos;s the cheapest call for an agent loop.
      </Prose>
    </div>
  )
}
