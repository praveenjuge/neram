"use client"

import { ClerkProvider, useAuth } from "@clerk/nextjs"
import { shadcn } from "@clerk/ui/themes"
import { ConvexReactClient } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache"
import { type ReactNode, StrictMode } from "react"

import { MissingEnv } from "@/components/missing-env"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <ThemeProvider>
        <TooltipProvider>
          {clerkKey && convex ? (
            <ClerkProvider
              appearance={{ theme: shadcn }}
              publishableKey={clerkKey}
            >
              <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
                <ConvexQueryCacheProvider>{children}</ConvexQueryCacheProvider>
              </ConvexProviderWithClerk>
            </ClerkProvider>
          ) : (
            <MissingEnv />
          )}
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </ThemeProvider>
    </StrictMode>
  )
}
