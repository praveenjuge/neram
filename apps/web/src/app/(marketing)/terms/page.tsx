import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms",
  description: "Neram terms — MIT, hosted use, and fair use.",
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl font-medium tracking-tight">
        Terms
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Last updated: Aug 19, 2026. Neram is MIT-licensed. The hosted instance
        at <code>neram.praveenjuge.com</code> is provided as-is, free during
        early development, with no SLA.
      </p>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">License</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Neram source is MIT. You may self-host, fork, and modify. See{" "}
          <code>LICENSE</code> in the repository.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">Hosted use</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Do not abuse the Convex or Clerk backends, scrape, or attempt to
          exceed rate limits. Destructive operations (delete project/workspace,
          rollover Sprint) require exact Organization confirmation and are
          non-recoverable.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">Changes</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          We may change this page as the product evolves. Material changes will
          bump the date above.
        </p>
      </section>
    </div>
  )
}
