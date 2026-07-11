import { useUser } from "@clerk/expo"
import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { useMutation, useQuery } from "convex/react"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { useMemo, useState } from "react"
import { Alert } from "react-native"

import { HeaderIconButton } from "@/lib/header"
import { NativeTextPrompt } from "@/lib/task-ui"
import { useOrganizationMembers } from "@/lib/use-organization-members"
import {
  Empty,
  Row,
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
  const [status, setStatus] = useState<Status>("todo")
  const [creatingTask, setCreatingTask] = useState(false)
  const project = useQuery(api.projects.get, { projectId: id })
  const tasks = useQuery(api.tasks.list, { projectId: id })
  const { members, loading: membersLoading } = useOrganizationMembers()
  const { user } = useUser()
  const createTask = useMutation(api.tasks.create)

  const visibleTasks = useMemo(
    () => tasks?.filter((task) => task.status === status) ?? [],
    [tasks, status]
  )

  function createAndOpenTask(
    title: string,
    sprint: "backlog" | "current" | "upcoming"
  ) {
    void createTask({ projectId: id, title, sprint }).then((taskId) =>
      router.push(`/task/${taskId}?projectId=${id}`)
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderIconButton
              name="plus"
              label="New task"
              onPress={() => setCreatingTask(true)}
            />
          ),
        }}
      />
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
            </>
          )}
        </Section>
        <Section title="People">
          {members.map((member) => (
            <Text key={member.userId}>{`${member.displayName} - ${member.role}${member.userId === user?.id ? " - you" : ""}`}</Text>
          ))}
          {membersLoading ? <Text>Loading members...</Text> : null}
        </Section>
        <Section title="Board">
          <StatusPicker value={status} onChange={setStatus} />
          {tasks === undefined ? (
            <Text>Loading board...</Text>
          ) : visibleTasks.length === 0 ? (
            <Empty
              title={`No ${labelFor(status)} tasks`}
              detail="Tap + to add a task or switch status."
            />
          ) : (
            visibleTasks.map((task) => (
              <Row
                key={task._id}
                label={task.title}
                systemImage={symbolFor(task.status)}
                onPress={() => router.push(`/task/${task._id}?projectId=${id}`)}
              />
            ))
          )}
        </Section>
      </Screen>
      <NativeTextPrompt
        detail="Give your task a title."
        onClose={() => setCreatingTask(false)}
        onSubmit={(value) => {
          const title = value.trim()
          if (!title) return
          setCreatingTask(false)
          Alert.alert("Plan task", "Choose its initial Sprint.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Backlog",
              onPress: () => createAndOpenTask(title, "backlog"),
            },
            {
              text: "Current",
              onPress: () => createAndOpenTask(title, "current"),
            },
            {
              text: "Upcoming",
              onPress: () => createAndOpenTask(title, "upcoming"),
            },
          ])
        }}
        submitLabel="Create"
        title="New task"
        visible={creatingTask}
      />
    </>
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
