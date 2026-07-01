---
name: neram-mcp
description: Connect AI agents to Neram through Model Context Protocol. Use when configuring Codex, Claude, Cursor, or another MCP client to call Neram tools locally over stdio or remotely at https://neram.praveenjuge.com/mcp.
---

# Neram MCP

Use Neram MCP when an agent needs structured workspace tools instead of
screen-scraping the web app. The local stdio server and hosted Streamable HTTP
endpoint are backed by the same canonical tool implementation.

## Local Stdio

Authenticate first:

```bash
npx neram login
```

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

## Hosted Streamable HTTP

Endpoint:

```text
https://neram.praveenjuge.com/mcp
```

Send a Clerk OAuth `id_token` in `Authorization: Bearer <token>`. The endpoint
returns `401` without a bearer token; that is the expected unauthenticated
smoke-test result.

## Tools

- `daily_brief`: compact daily execution digest.
- `capture_task`: create a task in a project.
- `move_task`: move/reorder/update task status.
- `complete_task`: mark a task done.
- `check_in_project`: update personal project recency.
- `summarize_project`: return compact project/task context for LLMs.

All tools return structured content and stable error codes. Prefer project and
task IDs for automation; name/title resolution intentionally rejects ambiguous
matches.
