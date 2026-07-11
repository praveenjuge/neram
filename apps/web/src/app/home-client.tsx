"use client"

import { OrganizationList, SignIn, useAuth, useOrganization } from "@clerk/nextjs"
import { CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { workspaceHref } from "@/lib/workspace"

export function HomeClient() {
  const { isLoaded, isSignedIn } = useAuth()
  const { organization } = useOrganization()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn && organization?.slug) {
      router.replace(workspaceHref(organization.slug))
    }
  }, [isLoaded, isSignedIn, organization?.slug, router])

  if (!isLoaded || (isSignedIn && organization?.slug))
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <Spinner className="size-6 text-muted-foreground" />
      </main>
    )

  if (isSignedIn) {
    return (
      <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
        <OrganizationList
          afterCreateOrganizationUrl="/w/:slug/dashboard"
          afterSelectOrganizationUrl="/w/:slug/dashboard"
          hidePersonal
        />
      </main>
    )
  }

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
      <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-2">
        <section className="space-y-7">
          <div className="space-y-1">
            <h1 className="font-heading text-xl font-medium tracking-normal">
              Neram
            </h1>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Organization-wide projects and Sprints for keeping commitments,
              due dates, and task status in one quiet place.
            </p>
          </div>
          <ul className="grid gap-2 text-sm text-muted-foreground">
            {[
              "Cross-project Sprint planning",
              "Commitment and carryover history",
              "Clerk-managed workspaces and members",
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
            forceRedirectUrl="/"
            signUpForceRedirectUrl="/"
            withSignUp
          />
        </div>
      </div>
    </main>
  )
}
