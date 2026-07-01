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

## License

MIT
