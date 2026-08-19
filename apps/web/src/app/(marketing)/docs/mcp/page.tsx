import type { Metadata } from "next"

import { CodeBlock, H1, H2, H3, Lead, Prose } from "../components"

export const metadata: Metadata = {
  title: "MCP",
  description:
    "Neram MCP — local stdio and hosted Streamable HTTP, same tools.",
}

const stdio = `npx neram login   # sign in first
npx neram mcp     # stdio server; refreshes the token per request

# print a client config without writing files (also: cursor, vscode)
npx neram mcp install claude-code

# Claude Code one-liner
claude mcp add neram -- npx neram mcp`

const config = `{
  "mcpServers": {
    "neram": {
      "command": "npx",
      "args": ["neram", "mcp"]
    }
  }
}`

const hosted = `# hosted Streamable HTTP; send a Clerk id_token
curl -s https://neram.praveenjuge.com/mcp \\
  -H "Authorization: Bearer $NERAM_ID_TOKEN"`

const tools = `# read-only
daily_brief
workspace_status
get_workspace
list_workspace_members
get_sprint
list_sprint_tasks
list_upcoming_sprints
sprint_history
list_projects
list_tasks
get_task
list_subtasks
list_task_comments
summarize_project
recent_activity

# mutations
capture_task
update_task
move_task              # optional position for kanban order
complete_task
move_task_to_project
delete_task
create_subtask
rename_subtask
set_subtask_completed
reorder_subtask
delete_subtask
create_comment
reply_to_comment
edit_comment
delete_comment
create_project
update_project
delete_project          # destructive — purges every task
create_workspace
invite_workspace_member
update_workspace_member_role
remove_workspace_member # destructive — exact Organization confirmation
delete_workspace        # destructive — exact Organization confirmation
plan_sprint_tasks
remove_sprint_tasks
update_sprint_goal
update_sprint_cadence
schedule_sprint
rename_sprint
unschedule_sprint
rollover_sprint         # destructive — exact Organization confirmation

# failures return isError results with:
# { error: { code, message, details } }`

export default function McpPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <H1>MCP</H1>
      <Lead>
        Local stdio and hosted Streamable HTTP run the same Organization-scoped
        tools. Tool failures come back as <code>isError</code> results (not
        protocol exceptions) with stable error codes.
      </Lead>

      <H2>Local stdio</H2>
      <Prose>
        Authenticate first with <code>neram login</code>. <code>neram mcp</code>{" "}
        fails fast with a friendly stderr message when you aren&apos;t logged in
        — it never auto-logs-in from startup.
      </Prose>
      <div className="mt-3 grid gap-3">
        <CodeBlock lang="bash">{stdio}</CodeBlock>
        <CodeBlock label="MCP client config" lang="json">
          {config}
        </CodeBlock>
      </div>

      <H2>Hosted Streamable HTTP</H2>
      <CodeBlock lang="bash">{hosted}</CodeBlock>
      <Prose>
        Send a Clerk OAuth <code>id_token</code> in{" "}
        <code>Authorization: Bearer</code>. The endpoint returns{" "}
        <code>401</code> without a bearer token; that is the expected
        unauthenticated smoke-test result. Public client config is at{" "}
        <code>/.well-known/neram-agent.json</code>.
      </Prose>

      <H2>Tools</H2>
      <CodeBlock lang="bash">{tools}</CodeBlock>

      <H3>IDs vs names</H3>
      <Prose>
        Prefer project and task ids for automation; name/title resolution
        intentionally rejects ambiguous matches with <code>AMBIGUOUS</code> and
        candidate ids in <code>details.matches</code>.
      </Prose>
    </div>
  )
}
