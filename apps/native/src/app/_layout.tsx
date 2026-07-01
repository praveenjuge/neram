import { ClerkProvider, useAuth } from "@clerk/expo"
import { tokenCache } from "@clerk/expo/token-cache"
import { ConvexReactClient } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { Stack } from "expo-router"
import { useMemo } from "react"

import { Empty, Screen, Section } from "@/lib/ui"

const clerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL

export default function RootLayout() {
  const convex = useMemo(
    () =>
      convexUrl
        ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false })
        : null,
    []
  )

  if (!clerkKey || !convex) {
    return (
      <Screen>
        <Section title="Configuration">
          <Empty
            title="Missing Expo public keys"
            detail="Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY and EXPO_PUBLIC_CONVEX_URL."
          />
        </Section>
      </Screen>
    )
  }

  return (
    <ClerkProvider publishableKey={clerkKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="project/[projectId]"
            options={{ title: "Project" }}
          />
          <Stack.Screen name="task/[taskId]" options={{ title: "Task" }} />
          <Stack.Screen name="profile" options={{ title: "Profile" }} />
        </Stack>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
