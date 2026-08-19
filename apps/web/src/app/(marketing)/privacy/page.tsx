import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy",
  description: "Neram privacy — how workspace data is handled.",
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl font-medium tracking-tight">
        Privacy
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Last updated: Aug 19, 2026. This is a minimal, developer-oriented notice
        for the hosted instance at <code>neram.praveenjuge.com</code>. If you
        self-host Neram, this does not apply beyond your own deployment.
      </p>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">Data we store</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Workspaces are Clerk Organizations. We store projects, tasks, and
          Sprint history in Convex under your Organization id. Clerk holds
          identity (email, name, org membership). Neram does not sell your data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">OAuth and tokens</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          <code>neram login</code> uses Clerk OAuth Authorization Code with PKCE
          and loopback callback. Tokens live in OS keychain when available,
          fallback to <code>~/.config/neram/credentials.json</code> (0600).
          Hosted MCP requires a Clerk <code>id_token</code> per request — we do
          not persist it server-side.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">Analytics</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          The marketing site currently runs with no analytics (per launch
          choice). If we add cookieless analytics later, it will be disclosed
          here with no cross-site tracking.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">Contact</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Questions: open an issue at{" "}
          <a className="underline" href="https://github.com/praveenjuge/neram">
            github.com/praveenjuge/neram
          </a>
          .
        </p>
      </section>
    </div>
  )
}
