import { SignInButton, SignUpButton, useAuth } from "@clerk/react"
import { Navigate, createFileRoute } from "@tanstack/react-router"
import { ArrowRight, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export const Route = createFileRoute("/")({
  component: Home,
})

function Home() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded)
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <Spinner className="size-6 text-muted-foreground" />
      </main>
    )
  if (isSignedIn) return <Navigate to="/dashboard" replace />

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
      <section className="max-w-xl space-y-7">
        <div className="space-y-3">
          <h1 className="font-heading text-3xl font-medium tracking-normal">
            Neram
          </h1>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            A personal project board for keeping projects, due dates, and task
            status in one quiet place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SignUpButton mode="redirect">
            <Button data-testid="home-sign-up">
              Create account <ArrowRight />
            </Button>
          </SignUpButton>
          <SignInButton mode="redirect">
            <Button variant="outline" data-testid="home-sign-in">
              Sign in
            </Button>
          </SignInButton>
        </div>
        <ul className="grid gap-2 text-sm text-muted-foreground">
          {[
            "Personal projects only",
            "Persistent kanban status",
            "Due dates without noisy setup",
          ].map((item) => (
            <li className="flex items-center gap-2" key={item}>
              <CheckCircle2 className="size-4 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
