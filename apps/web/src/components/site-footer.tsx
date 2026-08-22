import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1">
            <span className="size-1.5 rounded-full bg-foreground" />
            MIT · Free hosted
          </span>
          <span className="hidden sm:inline">— Quiet commitments.</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            className="transition hover:text-foreground"
            href="https://github.com/praveenjuge/neram"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
          <Link className="transition hover:text-foreground" href="/docs/privacy">
            Privacy
          </Link>
          <Link className="transition hover:text-foreground" href="/docs/terms">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  )
}
