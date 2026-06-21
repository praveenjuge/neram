import { RedirectToSignIn, UserButton } from "@clerk/react"
import { Link } from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
} from "convex/react"
import type { ReactNode } from "react"
import { useEffect, useRef } from "react"

import { api } from "../../convex/_generated/api"
import { ThemeToggle } from "@/components/theme-toggle"
import { Spinner } from "@/components/ui/spinner"

const OWNERSHIP_MIGRATION_KEY = "neram:ownership-migrated"

/**
 * Once per session, re-key the signed-in user's documents from the legacy
 * `identity.subject` owner key to the canonical `identity.tokenIdentifier`.
 * Best-effort and idempotent: the mutation returns 0 once there is nothing left
 * to migrate, and any failure simply retries on the next session.
 */
function OwnershipMigrator() {
  const migrate = useMutation(api.projects.migrateOwnership)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (sessionStorage.getItem(OWNERSHIP_MIGRATION_KEY) === "1") return

    let active = true
    void (async () => {
      try {
        for (let i = 0; i < 25 && active; i++) {
          const { migrated } = await migrate({})
          if (migrated === 0) break
        }
        sessionStorage.setItem(OWNERSHIP_MIGRATION_KEY, "1")
      } catch {
        // Ignore: a later session will retry.
      }
    })()
    return () => {
      active = false
    }
  }, [migrate])

  return null
}

export function Protected({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <main className="grid min-h-svh place-items-center p-6">
          <Spinner className="size-6 text-muted-foreground" />
        </main>
      </AuthLoading>
      <Unauthenticated>
        <RedirectToSignIn signInForceRedirectUrl="/dashboard" />
      </Unauthenticated>
      <Authenticated>
        <OwnershipMigrator />
        {children}
      </Authenticated>
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
        <Link className="font-heading font-medium" to="/dashboard">
          {title}
        </Link>
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
