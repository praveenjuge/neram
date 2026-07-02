---
name: neram-cli
description: Operate Neram workspaces through the `neram` CLI. Use when a user wants an agent to log in, run Neram workspace diagnostics, get daily briefs, create/move/complete tasks, check in on projects, summarize projects, or script Neram from shell/CI using JSON output.
---

# Neram CLI

Use the published `neram` CLI as the canonical command surface for agent and
script access to Neram. Prefer CLI commands over browser automation for task,
project, and daily-brief workflows.

## Setup

Install/run through npm:

```bash
npx neram login
npx neram doctor --json
```

`neram login` opens Clerk OAuth in the browser with PKCE and stores tokens in
the OS keychain, with a chmod-600 file fallback. Do not ask users to paste
tokens unless the OAuth flow is unavailable.

## Core Commands

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

`neram whoami` reports your identity and workspace totals (visible projects,
owned/shared split, open tasks) plus MCP readiness hints. `neram logout` clears
local credentials, best-effort revokes the refresh token (reported as
succeeded/skipped/failed), and keeps the cached public config.

Use `--project-id` for exact IDs. Use `--project` only when the name is
unambiguous; the CLI rejects ambiguous matches instead of guessing.

## Validation

Run diagnostics before larger automation:

```bash
npx neram doctor --json
```

Treat `UNAUTHENTICATED`, `MISSING_CONFIG`, `AMBIGUOUS`, `NOT_FOUND`,
`FORBIDDEN`, and `VALIDATION` error codes as actionable machine-readable states.

## Notes

- Agent actions appear as the signed-in Neram user.
- The CLI uses the hosted config at
  `https://neram.praveenjuge.com/.well-known/neram-agent.json`.
- Override config only for development with `NERAM_CONVEX_URL`,
  `NERAM_CLERK_FRONTEND_API_URL`, and `NERAM_CLERK_OAUTH_CLIENT_ID`.
