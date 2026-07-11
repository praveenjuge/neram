import { useAuth, useOrganization, useOrganizationList } from "@clerk/expo"
import { api } from "@neram/convex/api"
import { AuthView } from "@clerk/expo/native"
import { useAction } from "convex/react"
import { NativeTabs } from "expo-router/unstable-native-tabs"
import { useEffect, useState } from "react"
import { Alert, Modal } from "react-native"

import { Button, Empty, Screen, Section, Text } from "@/lib/ui"
import { accentColor } from "@/lib/theme"

export default function TabsLayout() {
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false })
  const [authOpen, setAuthOpen] = useState(false)
  const { organization } = useOrganization()
  const { isLoaded: organizationsLoaded, createOrganization, setActive, userMemberships } =
    useOrganizationList({ userMemberships: { infinite: true, pageSize: 100 } })
  const syncCurrent = useAction(api.organizationActions.syncCurrent)
  const [syncedOrganizationId, setSyncedOrganizationId] = useState<string | null>(null)

  useEffect(() => {
    if (!organization || syncedOrganizationId === organization.id) return
    let active = true
    void syncCurrent({})
      .then(() => {
        if (active) setSyncedOrganizationId(organization.id)
      })
      .catch((error) => {
        if (active) Alert.alert("Workspace unavailable", error instanceof Error ? error.message : "Try again.")
      })
    return () => {
      active = false
    }
  }, [organization, syncCurrent, syncedOrganizationId])

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

  if (!organizationsLoaded || (organization && syncedOrganizationId !== organization.id)) {
    return (
      <Screen>
        <Section title="Workspace">
          <Text>Preparing your workspace...</Text>
        </Section>
      </Screen>
    )
  }

  if (!organization) {
    return (
      <Screen>
        <Section title="Choose a workspace">
          {userMemberships.data?.map((membership) => (
            <Button
              key={membership.id}
              label={membership.organization.name}
              systemImage="building.2"
              onPress={() => void setActive?.({ organization: membership.organization.id })}
            />
          ))}
          <Button
            label="Create workspace"
            systemImage="plus"
            onPress={() =>
              Alert.prompt("Create workspace", "Workspace name", (value?: string) => {
                const name = (value ?? "").trim()
                if (!name || !createOrganization) return
                void createOrganization({ name }).then((created) => setActive?.({ organization: created.id }))
              })
            }
          />
        </Section>
      </Screen>
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
      <NativeTabs.Trigger name="sprints">
        <NativeTabs.Trigger.Icon sf="arrow.triangle.2.circlepath" />
        <NativeTabs.Trigger.Label>Sprints</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Icon sf="clock" />
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
