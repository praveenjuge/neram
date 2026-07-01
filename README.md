# Neram

Neram is a project and task workspace built with Clerk, Convex, React, and Expo.

## Structure

```text
apps/
  web/            Vite, React, TanStack Router, and shadcn/ui
  native/         Expo iOS app
packages/
  convex/         Convex functions, generated API, and backend tests
```

## Setup

Install dependencies:

```bash
bun install --frozen-lockfile
```

Create local env files from the examples:

- `apps/web/.env.local` contains browser-safe `VITE_*` values.
- `apps/native/.env.local` contains browser-safe `EXPO_PUBLIC_*` values.
- `packages/convex/.env.local` contains Convex and Clerk configuration.

Start development:

```bash
bun run dev
```

## Commands

```bash
bun run lint
bun run test
bun run typecheck
bun run build
```

## Agent CLI and MCP

Neram includes a workspace-first agent package at `apps/agent`.

```bash
bun install --frozen-lockfile
bun --cwd apps/agent run build
neram login
neram doctor --json
neram daily --json
neram task add --project "Project name" --title "Follow up" --json
neram task move --task-id TASK_ID --status inProgress --json
neram task done --task-id TASK_ID --json
neram project check-in --project "Project name" --json
neram project summary --project "Project name" --json
neram mcp
```

`neram login` uses Clerk OAuth Authorization Code with PKCE. It opens the browser,
returns to a loopback `127.0.0.1` callback, stores tokens in the OS keychain when
available, and falls back to `~/.config/neram/credentials.json` with `0600`
permissions. The CLI sends Clerk OIDC `id_token` values to Convex so agent
actions run as the signed-in user.

MCP clients can use the local stdio server:

```json
{
  "mcpServers": {
    "neram": {
      "command": "neram",
      "args": ["mcp"]
    }
  }
}
```

The hosted Streamable HTTP MCP endpoint is:

```text
https://neram.praveenjuge.com/mcp
```

Pass `Authorization: Bearer <Clerk id_token>` for hosted MCP calls. Public CLI
configuration is served from `https://neram.praveenjuge.com/.well-known/neram-agent.json`.

## License

MIT
