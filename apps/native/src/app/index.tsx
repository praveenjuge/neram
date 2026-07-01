import { useAuth } from "@clerk/expo"
import { AuthView } from "@clerk/expo/native"
import { api } from "@neram/convex/api"
import { useMutation, usePaginatedQuery, useQuery } from "convex/react"
import { router } from "expo-router"
import { useState } from "react"
import { Modal } from "react-native"

import { Button, Empty, Field, Screen, Section, Text, VStack } from "@/lib/ui"

export default function Dashboard() {
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false })
  const [authOpen, setAuthOpen] = useState(false)
  const [name, setName] = useState("")
  const projects = useQuery(api.projects.list, isSignedIn ? {} : "skip")
  const createProject = useMutation(api.projects.create)
  const feed = usePaginatedQuery(
    api.activity.list,
    isSignedIn ? {} : "skip",
    { initialNumItems: 10 }
  )

  if (
    !process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.EXPO_PUBLIC_CONVEX_URL
  ) {
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
    <Screen>
      <Section title="Account">
        <Button
          label="Profile and sign out"
          systemImage="person.crop.circle"
          onPress={() => router.push("/profile")}
        />
      </Section>
      <Section title="New project">
        <Field placeholder="Project name" onChange={setName} />
        <Button
          label="Create project"
          systemImage="plus"
          onPress={() => {
            const trimmed = name.trim()
            if (!trimmed) return
            void createProject({
              name: trimmed,
              icon: "folder",
              color: "blue",
            }).then((id) => router.push(`/project/${id}`))
          }}
        />
      </Section>
      <Section title="Projects">
        {projects === undefined ? (
          <Text>Loading projects...</Text>
        ) : projects.length === 0 ? (
          <Empty
            title="No projects yet"
            detail="Create one above to start a native board."
          />
        ) : (
          projects.map((project) => (
            <Button
              key={project._id}
              label={`${project.name} - ${project.taskCount} tasks`}
              systemImage="folder"
              onPress={() => router.push(`/project/${project._id}`)}
            />
          ))
        )}
      </Section>
      <Section title="Activity">
        {feed.status === "LoadingFirstPage" ? (
          <Text>Loading activity...</Text>
        ) : feed.results.length === 0 ? (
          <Empty
            title="No activity yet"
            detail="Task changes will appear here as Convex updates."
          />
        ) : (
          feed.results.map((item) => (
            <VStack key={item._id} alignment="leading" spacing={2}>
              <Text>{item.projectName}</Text>
              <Text>{activityLine(item)}</Text>
            </VStack>
          ))
        )}
      </Section>
    </Screen>
  )
}

function activityLine(item: {
  actorName: string
  type: string
  taskTitle?: string
  toStatus?: string
}) {
  if (item.type === "task.created")
    return `${item.actorName} created ${item.taskTitle}`
  if (item.type === "task.moved")
    return `${item.actorName} moved ${item.taskTitle} to ${item.toStatus}`
  if (item.type === "task.assigned")
    return `${item.actorName} assigned ${item.taskTitle}`
  if (item.type === "project.updated")
    return `${item.actorName} updated the project`
  if (item.type === "member.joined") return `${item.actorName} joined`
  if (item.type === "member.left") return `${item.actorName} left`
  if (item.type === "member.removed") return `${item.actorName} was removed`
  return `${item.actorName} updated ${item.taskTitle ?? "the project"}`
}
