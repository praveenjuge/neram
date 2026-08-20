import Link from "next/link"
import type { ReactNode } from "react"

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link
            className="font-heading text-sm font-medium tracking-tight"
            href="/"
          >
            Neram
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              href="/docs"
            >
              Docs
            </Link>
            <a
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              href="https://github.com/praveenjuge/neram"
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            <a
              className="ml-1 inline-flex h-7 items-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              href="https://accounts.neram.praveenjuge.com/sign-in?redirect_url=https%3A%2F%2Fneram.praveenjuge.com%2Fw"
            >
              Sign in
            </a>
          </nav>
        </div>
      </header>
      <div>{children}</div>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs">
              <span className="size-1.5 rounded-full bg-primary" />
              MIT · Free hosted
            </span>
            <span className="hidden sm:inline">— Quiet commitments.</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              className="hover:text-foreground"
              href="https://github.com/praveenjuge/neram"
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            <Link className="hover:text-foreground" href="/docs/privacy">
              Privacy
            </Link>
            <Link className="hover:text-foreground" href="/docs/terms">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
