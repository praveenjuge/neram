import { RedirectToSignIn, UserButton } from "@clerk/react"
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import type { ReactNode } from "react"

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

export function AppHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b px-5 py-3">
      <a className="font-heading text-lg font-medium" href="/dashboard">
        {title}
      </a>
      <UserButton />
    </header>
  )
}
