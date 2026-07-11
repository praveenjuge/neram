# Neram CLI

Neram's `neram` package gives AI agents and scripts a first-class CLI plus a
local stdio MCP server for working with a signed-in user's Neram workspace.

```bash
npx neram login
npx neram whoami
npx neram workspace current --json
npx neram sprint current --json
npx neram mcp
```

Every command prints quiet, human-friendly output by default. Add `--json` to
any command for stable, machine-readable output; the JSON shape is additive and
backward compatible, so the `--json` payload is exactly the underlying tool
result.

- `neram login` completes Clerk OAuth (PKCE) with `user:org:read`, lets the user
  select a Clerk Organization, and stores that Organization-bound session in
  the OS keychain, with a chmod-600 file fallback.
- `neram whoami` shows your identity, active Organization and role, workspace
  totals, and MCP readiness hints.
- `neram logout` clears local credentials, best-effort revokes the refresh
  token, and keeps the cached public config for your next login.
- `neram mcp` starts the local stdio MCP server and fails fast with a friendly
  message when you aren't logged in. It refreshes the auth token per request, so
  a long-lived server keeps working past token expiry as long as a refresh
  token exists.
- `neram mcp install [claude-code|cursor|vscode]` prints (does not write) the
  config snippet for wiring the server into a client.

## Workspace commands

```bash
neram workspace current
neram workspace create --name "Acme" [--slug acme]
neram workspace switch
neram workspace members
neram workspace invite --email member@example.com [--role org:member]
neram workspace role --user-id USER_ID --role org:admin
neram workspace remove-member --user-id USER_ID --organization-id ORG_ID --organization-slug SLUG --confirm
neram workspace delete --organization-id ORG_ID --organization-slug SLUG --confirm

neram sprint current                     # also: backlog, upcoming
neram sprint history [--sprint-id SPRINT_ID] [--limit 20] [--cursor CURSOR]
neram sprint plan --task-id TASK_ID [TASK_ID...] --sprint current|upcoming|backlog
neram sprint remove --task-id TASK_ID [TASK_ID...] --sprint current|upcoming
neram sprint goal --sprint current|upcoming (--goal "Outcome" | --clear)
neram sprint cadence --weeks 2 --start-weekday 1 --timezone Asia/Kolkata
neram sprint rollover --reason "Customer deadline" --organization-id ORG_ID --organization-slug SLUG --confirm

neram daily [--project-limit <n>]        # daily execution digest
neram activity [--limit <n>]             # recent activity feed

neram task list -p <project> [--status <todo|inProgress|done>]
neram task show --task-id <id>
neram task add -p <project> -t <title> [-d <desc>] [--due <yyyy-mm-dd>] [--sprint backlog|current|upcoming]
neram task move -t <title> -p <project> --status <status>
neram task done -t <title> -p <project> [--confirm-incomplete-subtasks]
neram task update --task-id <id> [--title <t>] [--description <d>] [--due <date>] [--clear-assignee]
neram task rm --task-id <id> [--confirm-cascade]
neram task move-to --task-id <id> --to-project <name>

neram task subtask list --task-id <id>
neram task subtask add --task-id <id> --title <title>
neram task subtask rename --subtask-id <id> --title <title>
neram task subtask done|reopen --subtask-id <id>
neram task subtask move --subtask-id <id> (--before-id <id> | --after-id <id>)
neram task subtask rm --subtask-id <id>

neram task comment list --task-id <id> [--parent-comment-id <id>] [--limit <n>] [--cursor <cursor>]
neram task comment add --task-id <id> --body 'Hi @[Praveen](subject)'
neram task comment reply --comment-id <id> --body <text>
neram task comment edit --comment-id <id> --body <text>
neram task comment rm --comment-id <id>

neram project list
neram project add --name <name> [--icon <icon>] [--color <color>]
neram project update -p <project> [--name <name>] [--icon <icon>] [--color <color>]
neram project rm --project-id <id>       # id required; purges the project's tasks
neram project summary -p <project>
```

Tasks and projects can be addressed by id (`--task-id` / `--project-id`) or by an
unambiguous name (`--project` / `--title`). An ambiguous name returns an
`AMBIGUOUS` error whose details list the candidate ids to retry with.

## MCP tools

Read-only: `daily_brief`, `workspace_status`, `get_workspace`,
`list_workspace_members`, `get_sprint`, `list_sprint_tasks`, `sprint_history`,
`list_projects`, `list_tasks`, `get_task`, `list_subtasks`,
`list_task_comments`, `summarize_project`, `recent_activity`.

Mutations: `capture_task`, `update_task`, `move_task`, `complete_task`,
`move_task_to_project`, `delete_task`, `create_project`, `update_project`,
`delete_project`, `create_subtask`, `rename_subtask`, `set_subtask_completed`,
`reorder_subtask`, `delete_subtask`, `create_comment`, `reply_to_comment`,
`edit_comment`, `delete_comment`.

Organization and Sprint mutations: `create_workspace`,
`invite_workspace_member`, `update_workspace_member_role`,
`remove_workspace_member`, `delete_workspace`, `plan_sprint_tasks`,
`remove_sprint_tasks`, `update_sprint_goal`, `update_sprint_cadence`, and
`rollover_sprint`.

Tools carry annotations (read-only / idempotent / destructive) and stable output
schemas for mutation shapes. Organization removal/deletion and early rollover
require the exact Organization ID and slug plus confirmation. Tool failures come back as `isError`
results carrying `{ error: { code, message, details } }` rather than
protocol-level exceptions, so agents can read `AMBIGUOUS` candidate lists and act
on stable codes. Local and hosted MCP are scoped to the Organization selected
during OAuth; switch with `neram workspace switch`, then reconnect the client.

Docs: https://neram.praveenjuge.com/docs
