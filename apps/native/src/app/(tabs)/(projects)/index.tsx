import { useAuth } from "@clerk/expo"
import { api } from "@neram/convex/api"
import { useMutation, useQuery } from "convex/react"
import { router, Stack } from "expo-router"
import { useState } from "react"

import { HeaderAvatar, HeaderIconButton, HeaderRow } from "@/lib/header"
import { NativeTextPrompt } from "@/lib/task-ui"
import { Empty, Row, Screen, Section, Text } from "@/lib/ui"

export default function ProjectsScreen() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false })
  const projects = useQuery(api.projects.list, isSignedIn ? {} : "skip")
  const createProject = useMutation(api.projects.create)
  const [creatingProject, setCreatingProject] = useState(false)

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderRow>
              <HeaderIconButton
                name="plus"
                label="New project"
                onPress={() => setCreatingProject(true)}
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
      <NativeTextPrompt
        detail="Give your project a name."
        onClose={() => setCreatingProject(false)}
        onSubmit={(value) => {
          const name = value.trim()
          if (!name) return
          setCreatingProject(false)
          void createProject({
            name,
            icon: "folder",
            color: "green",
          }).then((id) => router.push(`/project/${id}`))
        }}
        submitLabel="Create"
        title="New project"
        visible={creatingProject}
      />
    </>
  )
}
