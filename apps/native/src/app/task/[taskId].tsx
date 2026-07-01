import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { useMutation, useQuery } from "convex/react"
import { router, useLocalSearchParams } from "expo-router"
import { useState } from "react"

import {
  Button,
  Empty,
  Field,
  Screen,
  Section,
  Status,
  StatusPicker,
  Text,
} from "@/lib/ui"

export default function TaskScreen() {
  const { projectId, taskId } = useLocalSearchParams<{
    projectId?: string
    taskId: string
  }>()
  const id = taskId as Id<"tasks">
  const project = projectId as Id<"projects"> | undefined
  const tasks = useQuery(
    api.tasks.list,
    project ? { projectId: project } : "skip"
  )
  const task = tasks?.find((candidate) => candidate._id === id) ?? null
  const updateTask = useMutation(api.tasks.update)
  const moveTask = useMutation(api.tasks.move)
  // `null` means "not edited": we only send a field to the mutation when the
  // user actually changed it, so saving after editing only the title (or just
  // tapping save) never overwrites the stored description with an empty string.
  const [title, setTitle] = useState<string | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [status, setStatus] = useState<Status | null>(null)

  if (tasks === undefined) {
    return (
      <Screen>
        <Section title="Task">
          <Text>Loading task...</Text>
        </Section>
      </Screen>
    )
  }

  if (task === null) {
    return (
      <Screen>
        <Section title="Task">
          <Empty
            title="Task unavailable"
            detail="It may have been removed or access changed."
          />
        </Section>
      </Screen>
    )
  }

  return (
    <Screen>
      <Section title="Task">
        <Text>{task.title}</Text>
        <Text>{task.description ?? "No description"}</Text>
      </Section>
      <Section title="Edit">
        <Field value={task.title} placeholder="Title" onChange={setTitle} />
        <Field
          value={task.description}
          placeholder="Description"
          multiline
          onChange={setDescription}
        />
        <Button
          label="Save task"
          systemImage="square.and.arrow.down"
          onPress={() => {
            const patch: {
              taskId: Id<"tasks">
              title?: string
              description?: string
            } = { taskId: id }
            // Only include fields the user edited. Omitting a field tells the
            // mutation to leave it untouched; sending an edited (possibly empty)
            // description still lets the user clear it on purpose.
            if (title !== null) patch.title = title.trim() || task.title
            if (description !== null) patch.description = description
            void updateTask(patch)
          }}
        />
      </Section>
      <Section title="Status">
        <StatusPicker value={status ?? task.status} onChange={setStatus} />
        <Button
          label="Move task"
          systemImage="arrow.right.circle"
          onPress={() => void moveTask({ taskId: id, status: status ?? task.status })}
        />
      </Section>
      <Section title="Project">
        <Button label="Back to project" systemImage="folder" onPress={() => router.push(`/project/${task.projectId}`)} />
      </Section>
    </Screen>
  )
}
