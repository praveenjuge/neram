"use client"

import {
  OrganizationList,
  SignIn,
  useAuth,
  useOrganization,
} from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { Spinner } from "@/components/ui/spinner"
import { workspaceHref } from "@/lib/workspace"
import { AppProviders } from "@/components/app-providers"

function Inner() {
  const { isLoaded, isSignedIn } = useAuth()
  const { organization } = useOrganization()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn && organization?.slug) {
      router.replace(workspaceHref(organization.slug))
    }
  }, [isLoaded, isSignedIn, organization?.slug, router])

  if (!isLoaded || (isSignedIn && organization?.slug)) {
    return <Spinner className="size-6 text-muted-foreground" />
  }

  if (isSignedIn) {
    return (
      <OrganizationList
        afterCreateOrganizationUrl="/w/:slug/dashboard"
        afterSelectOrganizationUrl="/w/:slug/dashboard"
        hidePersonal
      />
    )
  }

  return (
    <SignIn
      routing="hash"
      forceRedirectUrl="/"
      signUpForceRedirectUrl="/"
      withSignUp
    />
  )
}

export function SignInClient() {
  return (
    <AppProviders>
      <Inner />
    </AppProviders>
  )
}
