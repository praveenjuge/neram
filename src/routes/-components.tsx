import { RedirectToSignIn, UserButton } from "@clerk/react"
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import type { ReactNode } from "react"

import { ThemeToggle } from "@/components/theme-toggle"

export function Protected({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <main className="p-6 text-sm">Loading...</main>
      </AuthLoading>
      <Unauthenticated>
        <RedirectToSignIn signInForceRedirectUrl="/dashboard" />
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </>
  )
}

export function AppHeader({
  title,
  crumb,
  actions,
}: {
  title: string
  crumb?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b px-5 py-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <a className="font-heading font-medium" href="/dashboard">
          {title}
        </a>
        {crumb ? (
          <>
            <span className="pl-3 font-heading font-medium text-muted-foreground">
              /
            </span>
            {crumb}
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <ThemeToggle />
        <UserButton />
      </div>
    </header>
  )
}
