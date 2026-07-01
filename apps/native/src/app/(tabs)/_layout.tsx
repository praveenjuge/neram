import { useAuth } from "@clerk/expo"
import { AuthView } from "@clerk/expo/native"
import { NativeTabs } from "expo-router/unstable-native-tabs"
import { useState } from "react"
import { Modal } from "react-native"

import { Button, Empty, Screen, Section, Text } from "@/lib/ui"
import { accentColor } from "@/lib/theme"

export default function TabsLayout() {
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false })
  const [authOpen, setAuthOpen] = useState(false)

  if (!isLoaded) {
    return (
      <Screen>
        <Section title="Loading">
          <Text>Preparing your session...</Text>
        </Section>
      </Screen>
    )
  }

  if (!isSignedIn) {
    return (
      <>
        <Screen>
          <Section title="Neram">
            <Empty
              title="Plan projects with live Convex sync"
              detail="Sign in with email to load your projects, board, tasks, and activity."
            />
            <Button
              label="Sign in"
              systemImage="envelope"
              onPress={() => setAuthOpen(true)}
            />
          </Section>
        </Screen>
        <Modal visible={authOpen} animationType="slide">
          <AuthView mode="signInOrUp" onDismiss={() => setAuthOpen(false)} />
        </Modal>
      </>
    )
  }

  return (
    <NativeTabs tintColor={accentColor}>
      <NativeTabs.Trigger name="(projects)">
        <NativeTabs.Trigger.Icon sf="folder" />
        <NativeTabs.Trigger.Label>Projects</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tasks">
        <NativeTabs.Trigger.Icon sf="checklist" />
        <NativeTabs.Trigger.Label>Tasks</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Icon sf="clock" />
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
