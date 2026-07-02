# Neram CLI

Neram's `neram` package gives AI agents and scripts a first-class CLI plus a
local stdio MCP server for working with a signed-in user's Neram workspace.

```bash
npx neram login
npx neram whoami
npx neram daily --json
npx neram mcp
```

`login`, `logout`, and `whoami` print quiet, human-friendly output by default.
Add `--json` to any command for stable, machine-readable output; the JSON shape
is additive and backward compatible.

- `neram login` completes Clerk OAuth (PKCE) and stores tokens in the OS
  keychain, with a chmod-600 file fallback. It makes no live workspace calls.
- `neram whoami` shows your identity and workspace totals (visible projects,
  owned/shared split, open tasks) plus MCP readiness hints.
- `neram logout` clears local credentials, best-effort revokes the refresh
  token, and keeps the cached public config for your next login.
- `neram mcp` starts the local stdio MCP server and fails fast with a friendly
  message when you aren't logged in.

The MCP server exposes `daily_brief`, `capture_task`, `move_task`,
`complete_task`, `check_in_project`, `summarize_project`, and `workspace_status`.

Docs: https://neram.praveenjuge.com/docs
