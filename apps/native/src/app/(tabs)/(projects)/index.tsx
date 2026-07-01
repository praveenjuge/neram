import { useAuth } from "@clerk/expo"
import { api } from "@neram/convex/api"
import { useMutation, useQuery } from "convex/react"
import { router, Stack } from "expo-router"
import { Alert } from "react-native"

import { HeaderAvatar, HeaderIconButton, HeaderRow } from "@/lib/header"
import { Empty, Row, Screen, Section, Text } from "@/lib/ui"

export default function ProjectsScreen() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false })
  const projects = useQuery(api.projects.list, isSignedIn ? {} : "skip")
  const createProject = useMutation(api.projects.create)

  const promptNewProject = () => {
    Alert.prompt(
      "New project",
      "Give your project a name.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create",
          onPress: (value?: string) => {
            const trimmed = (value ?? "").trim()
            if (!trimmed) return
            void createProject({
              name: trimmed,
              icon: "folder",
              color: "green",
            }).then((id) => router.push(`/project/${id}`))
          },
        },
      ],
      "plain-text"
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderRow>
              <HeaderIconButton
                name="plus"
                label="New project"
                onPress={promptNewProject}
              />
              <HeaderAvatar />
            </HeaderRow>
          ),
        }}
      />
      <Screen>
        <Section title="Projects">
          {projects === undefined ? (
            <Text>Loading projects...</Text>
          ) : projects.length === 0 ? (
            <Empty
              title="No projects yet"
              detail="Tap + to create your first project."
            />
          ) : (
            projects.map((project) => (
              <Row
                key={project._id}
                label={`${project.name} - ${project.taskCount} tasks`}
                systemImage="folder"
                onPress={() => router.push(`/project/${project._id}`)}
              />
            ))
          )}
        </Section>
      </Screen>
    </>
  )
}
