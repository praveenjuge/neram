import { useAuth } from "@clerk/expo"
import { api } from "@neram/convex/api"
import { useMutation, useQuery } from "convex/react"
import { router } from "expo-router"
import { useState } from "react"

import { Button, Empty, Field, Screen, Section, Text } from "@/lib/ui"

export default function ProjectsScreen() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false })
  const [name, setName] = useState("")
  const projects = useQuery(api.projects.list, isSignedIn ? {} : "skip")
  const createProject = useMutation(api.projects.create)

  return (
    <Screen>
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
    </Screen>
  )
}
