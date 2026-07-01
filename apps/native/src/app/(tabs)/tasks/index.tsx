import { useAuth } from "@clerk/expo"
import { api } from "@neram/convex/api"
import { useQuery } from "convex/react"
import { router } from "expo-router"

import { Button, Empty, Screen, Section, Text, type Status } from "@/lib/ui"

export default function TasksScreen() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false })
  const tasks = useQuery(api.tasks.listAll, isSignedIn ? {} : "skip")

  return (
    <Screen>
      <Section title="My tasks">
        {tasks === undefined ? (
          <Text>Loading tasks...</Text>
        ) : tasks.length === 0 ? (
          <Empty
            title="No assigned tasks"
            detail="Tasks assigned to you across projects show up here."
          />
        ) : (
          tasks.map((task) => (
            <Button
              key={task._id}
              label={`${task.title} - ${task.projectName}`}
              systemImage={symbolFor(task.status)}
              onPress={() =>
                router.push(`/task/${task._id}?projectId=${task.projectId}`)
              }
            />
          ))
        )}
      </Section>
    </Screen>
  )
}

function symbolFor(status: Status) {
  if (status === "done") return "checkmark.circle"
  if (status === "inProgress") return "arrow.triangle.2.circlepath"
  return "circle"
}
