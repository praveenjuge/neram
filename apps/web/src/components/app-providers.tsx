"use client"

import { ClerkProvider, useAuth } from "@clerk/nextjs"
import { shadcn } from "@clerk/ui/themes"
import { ConvexReactClient } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache"
import type { ReactNode } from "react"

import { MissingEnv } from "@/components/missing-env"

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

export function AppProviders({ children }: { children: ReactNode }) {
  if (!clerkKey || !convex) {
    return <MissingEnv />
  }
  return (
    <ClerkProvider appearance={{ theme: shadcn }} publishableKey={clerkKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ConvexQueryCacheProvider>{children}</ConvexQueryCacheProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
