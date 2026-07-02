---
name: neram
description: Operate Neram workspaces and connect AI agents to Neram. Use when a user wants an agent to log in with Neram, run workspace diagnostics, get daily briefs, create/move/complete tasks, check in on projects, summarize projects, script Neram from shell/CI with JSON output, or configure Codex, Claude, Cursor, or another MCP client through local stdio or hosted Streamable HTTP at https://neram.praveenjuge.com/mcp.
---

# Neram

Use Neram's published CLI and MCP surfaces as the canonical agent access paths
for tasks, projects, daily briefs, and workspace status. Prefer these surfaces
over browser automation for structured Neram work.

## CLI Setup

Install/run through npm:

```bash
npx neram login
npx neram doctor --json
```

`neram login` opens Clerk OAuth in the browser with PKCE and stores tokens in
the OS keychain, with a chmod-600 file fallback. Do not ask users to paste
tokens unless the OAuth flow is unavailable.

## CLI Commands

`login`, `logout`, and `whoami` print quiet, human-friendly output by default.
Add `--json` whenever another agent, script, or test will consume output; the
JSON shape is additive and backward compatible.

```bash
npx neram whoami
npx neram whoami --json
npx neram daily --json
npx neram task add --project "Project name" --title "Follow up" --json
npx neram task move --task-id TASK_ID --status inProgress --json
npx neram task done --task-id TASK_ID --json
npx neram project check-in --project "Project name" --json
npx neram project summary --project "Project name" --json
```

`neram whoami` reports identity and workspace totals (visible projects,
owned/shared split, open tasks) plus MCP readiness hints. `neram logout` clears
local credentials, best-effort revokes the refresh token (reported as
succeeded/skipped/failed), and keeps the cached public config.

Use `--project-id` for exact IDs. Use `--project` only when the name is
unambiguous; the CLI rejects ambiguous matches instead of guessing.

Run diagnostics before larger automation:

```bash
npx neram doctor --json
```

Treat `UNAUTHENTICATED`, `MISSING_CONFIG`, `AMBIGUOUS`, `NOT_FOUND`,
`FORBIDDEN`, and `VALIDATION` error codes as actionable machine-readable states.

## MCP Setup

Use Neram MCP when an agent needs structured workspace tools. The local stdio
server and hosted Streamable HTTP endpoint are backed by the same canonical tool
implementation.

Authenticate before starting local stdio:

```bash
npx neram login
```

`neram mcp` fails fast with a friendly stderr message when you aren't logged in
(run `neram login`, then `neram mcp`); it never auto-logs-in from startup.

Client configuration:

```json
{
  "mcpServers": {
    "neram": {
      "command": "npx",
      "args": ["neram", "mcp"]
    }
  }
}
```

Hosted endpoint:

```text
https://neram.praveenjuge.com/mcp
```

Send a Clerk OAuth `id_token` in `Authorization: Bearer <token>`. The endpoint
returns `401` without a bearer token; that is the expected unauthenticated
smoke-test result.

## MCP Tools

- `daily_brief`: compact daily execution digest.
- `capture_task`: create a task in a project.
- `move_task`: move/reorder/update task status.
- `complete_task`: mark a task done.
- `check_in_project`: update personal project recency.
- `summarize_project`: return compact project/task context for LLMs.
- `workspace_status`: return the caller's identity and workspace totals
  (visible projects, owned/shared split, open tasks). No arguments.

All tools return structured content and stable error codes. Prefer project and
task IDs for automation; name/title resolution intentionally rejects ambiguous
matches.

## Notes

- Agent actions appear as the signed-in Neram user.
- The CLI uses the hosted config at
  `https://neram.praveenjuge.com/.well-known/neram-agent.json`.
- Override config only for development with `NERAM_CONVEX_URL`,
  `NERAM_CLERK_FRONTEND_API_URL`, and `NERAM_CLERK_OAUTH_CLIENT_ID`.
