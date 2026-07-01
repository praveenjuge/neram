import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { useMutation, useQuery } from "convex/react"
import { router, useLocalSearchParams } from "expo-router"
import { useMemo, useState } from "react"

import {
  Button,
  Empty,
  Field,
  Screen,
  Section,
  Status,
  StatusPicker,
  Text,
  statuses,
} from "@/lib/ui"

export default function ProjectScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>()
  const id = projectId as Id<"projects">
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<Status>("todo")
  const project = useQuery(api.projects.get, { projectId: id })
  const tasks = useQuery(api.tasks.list, { projectId: id })
  const members = useQuery(api.members.list, { projectId: id })
  const markWorked = useMutation(api.projects.markWorked)
  const createTask = useMutation(api.tasks.create)

  const visibleTasks = useMemo(
    () => tasks?.filter((task) => task.status === status) ?? [],
    [tasks, status]
  )

  return (
    <Screen>
      <Section title="Project">
        {project === undefined ? (
          <Text>Loading project...</Text>
        ) : project === null ? (
          <Empty
            title="Project unavailable"
            detail="It may have been removed or access changed."
          />
        ) : (
          <>
            <Text>{project.name}</Text>
            <Text>{`${project.taskCount} tasks - ${project.todoCount} todo - ${project.inProgressCount} active - ${project.doneCount} done`}</Text>
            <Button
              label="Check in"
              systemImage="clock"
              onPress={() => void markWorked({ projectId: id })}
            />
          </>
        )}
      </Section>
      <Section title="People">
        {members?.map((member) => (
          <Text key={member.subject}>{`${member.displayName} - ${member.role}${member.isYou ? " - you" : ""}`}</Text>
        )) ?? <Text>Loading members...</Text>}
      </Section>
      <Section title="New task">
        <Field placeholder="Task title" onChange={setTitle} />
        <Button
          label="Create task"
          systemImage="plus"
          onPress={() => {
            const trimmed = title.trim()
            if (!trimmed) return
            void createTask({ projectId: id, title: trimmed }).then((taskId) =>
              router.push(`/task/${taskId}`)
            )
          }}
        />
      </Section>
      <Section title="Board">
        <StatusPicker value={status} onChange={setStatus} />
        {tasks === undefined ? (
          <Text>Loading board...</Text>
        ) : visibleTasks.length === 0 ? (
          <Empty
            title={`No ${labelFor(status)} tasks`}
            detail="Use the task form above or switch status."
          />
        ) : (
          visibleTasks.map((task) => (
            <Button
              key={task._id}
              label={task.title}
              systemImage={symbolFor(task.status)}
              onPress={() => router.push(`/task/${task._id}?projectId=${id}`)}
            />
          ))
        )}
      </Section>
    </Screen>
  )
}

function labelFor(status: Status) {
  return statuses.find(([id]) => id === status)?.[1] ?? status
}

function symbolFor(status: Status) {
  if (status === "done") return "checkmark.circle"
  if (status === "inProgress") return "arrow.triangle.2.circlepath"
  return "circle"
}
