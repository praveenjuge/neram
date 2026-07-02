"use client"

import { SignIn, useAuth } from "@clerk/nextjs"
import { CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"

export function HomeClient() {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/dashboard")
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || isSignedIn)
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <Spinner className="size-6 text-muted-foreground" />
      </main>
    )

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
      <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-2">
        <section className="space-y-7">
          <div className="space-y-1">
            <h1 className="font-heading text-xl font-medium tracking-normal">
              Neram
            </h1>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              A personal project board for keeping projects, due dates, and task
              status in one quiet place.
            </p>
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
          <Button asChild size="sm" variant="outline">
            <Link href="/docs">Read docs</Link>
          </Button>
        </section>
        <div
          className="flex justify-center md:justify-end"
          data-testid="home-auth"
        >
          <SignIn
            routing="hash"
            signUpForceRedirectUrl="/dashboard"
            withSignUp
          />
        </div>
      </div>
    </main>
  )
}
