# Neram

Neram is a Clerk-authenticated project and task workspace backed by Convex.
The repository is a Bun-powered Turborepo with one deployable web app and one
canonical backend package.

## Structure

```text
apps/
  web/            Vite, React, TanStack Router, shadcn/ui, and PWA assets
packages/
  convex/         Convex functions, generated API, backend tests, and deployment
turbo.json        Repository task graph and cache inputs
vercel.json       Production web and Convex deployment pipeline
```

The web app consumes generated backend APIs through the
`@neram/convex` workspace package. Do not import files across package
boundaries with relative paths.

## Setup

Install the exact workspace graph from the repository root:

```bash
bun install --frozen-lockfile
```

Create package-local environment files from the examples:

- `apps/web/.env.local` contains browser-safe `VITE_*` values.
- `packages/convex/.env.local` contains the Convex deployment selection and
  Clerk issuer configuration.

Then start both package development processes:

```bash
bun run dev
```

## Canonical commands

All root commands delegate to package tasks through Turbo:

```bash
bun run routes
bun run codegen
bun run lint
bun run test
bun run typecheck
bun run build
```

`routes` runs before web typechecking and builds through Turbo's task graph.
Production deployment is push-driven through Vercel. Its build runs
`bun run deploy`, which deploys the Convex backend and builds the web app with
the resulting production URL exposed as `VITE_CONVEX_URL`.
