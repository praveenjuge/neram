import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { useMutation, usePaginatedQuery, useQuery } from "convex/react"
import { router } from "expo-router"
import { Alert } from "react-native"

import {
  Button,
  Empty,
  Row,
  Screen,
  Section,
  SegmentedPicker,
  Text,
} from "@/lib/ui"

const durationOptions = [
  ["1", "1w"],
  ["2", "2w"],
  ["4", "4w"],
  ["open", "Open"],
] as const
type DurationChoice = (typeof durationOptions)[number][0]

export default function FocusScreen() {
  const current = useQuery(api.sprints.current)
  const backlog = useQuery(api.sprints.backlog)
  const context = useQuery(api.organizations.current)
  const history = usePaginatedQuery(
    api.sprints.history,
    {},
    { initialNumItems: 10 }
  )
  const plan = useMutation(api.sprints.plan)
  const remove = useMutation(api.sprints.remove)
  const updateGoal = useMutation(api.sprints.updateGoal)
  const updateDuration = useMutation(api.sprints.updateDuration)
  const start = useMutation(api.sprints.start)
  const end = useMutation(api.sprints.end)

  const editGoal = (initial?: string) => {
    Alert.prompt(
      "Sprint goal",
      "What outcome matters most?",
      (value?: string) =>
        void updateGoal({
          goal: (value ?? "").trim() || undefined,
        }).catch(showError),
      "plain-text",
      initial
    )
  }

  const manageTask = (task: {
    _id: Id<"tasks">
    projectId: Id<"projects">
    title: string
    status: string
  }) => {
    const actions = [
      { text: "Cancel", style: "cancel" as const },
      {
        text: "Open task",
        onPress: () =>
          router.push(`/task/${task._id}?projectId=${task.projectId}`),
      },
    ]
    if (task.status !== "done") {
      actions.push({
        text: "Return to Backlog",
        onPress: () => void remove({ taskIds: [task._id] }).catch(showError),
      })
    }
    Alert.alert(task.title, undefined, actions)
  }

  const endSprint = () => {
    const unfinished =
      current?.tasks.filter((task) => task.status !== "done").length ?? 0
    Alert.alert(
      "End this Sprint?",
      `${unfinished} unfinished task${unfinished === 1 ? "" : "s"} will return to Backlog. The next Sprint starts empty.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Sprint",
          style: "destructive",
          onPress: () => void end({ confirm: true }).catch(showError),
        },
      ]
    )
  }

  const completed =
    current?.tasks.filter((task) => task.status === "done").length ?? 0

  return (
    <Screen>
      <Section title="Focus">
        {current === undefined ? (
          <Text>Loading Focus...</Text>
        ) : current === null ? (
          <>
            <Empty
              title="Choose what matters now"
              detail="Sprints are optional. Start one when you want a shared focus window."
            />
            <Button
              label="Start a Sprint"
              systemImage="play.fill"
              onPress={() => void start({}).catch(showError)}
            />
          </>
        ) : (
          <>
            <Text>
              {dateRange(current.sprint.startsAt, current.sprint.endsAt)}
            </Text>
            <Text>{`${completed} of ${current.tasks.length} completed`}</Text>
            <Text>{current.sprint.goal || "No goal set"}</Text>
            <Button
              label="Edit goal"
              systemImage="pencil"
              onPress={() => editGoal(current.sprint.goal)}
            />
            {current.tasks.length === 0 ? (
              <Empty
                title="No focused work"
                detail="Choose a few tasks from Backlog below."
              />
            ) : (
              current.tasks.map((task) => (
                <Row
                  key={task._id}
                  label={`${task.title} - ${task.projectName} - ${task.status}`}
                  systemImage={
                    task.status === "done" ? "checkmark.circle" : "circle"
                  }
                  onPress={() => manageTask(task)}
                />
              ))
            )}
            <Button
              label="End Sprint"
              systemImage="stop.fill"
              onPress={endSprint}
            />
          </>
        )}
      </Section>
      <Section title="Backlog">
        {backlog === undefined ? (
          <Text>Loading Backlog...</Text>
        ) : backlog.length === 0 ? (
          <Empty title="Backlog is empty" />
        ) : current === null ? (
          <Empty
            title={`${backlog.length} task${backlog.length === 1 ? "" : "s"} ready`}
            detail="Start a Sprint to choose focused work."
          />
        ) : (
          backlog.map((task) => (
            <Row
              key={task._id}
              label={`${task.title} - ${task.projectName}`}
              systemImage="plus.circle"
              onPress={() =>
                void plan({ taskIds: [task._id] }).catch(showError)
              }
            />
          ))
        )}
      </Section>
      <Section title="History">
        {history.status === "LoadingFirstPage" ? (
          <Text>Loading history...</Text>
        ) : history.results.length === 0 ? (
          <Empty title="No closed Sprints" />
        ) : (
          history.results.map((sprint) => (
            <Text key={sprint._id}>
              {`${dateRange(sprint.startsAt, sprint.endsAt)} - ${sprint.completedCount ?? 0} of ${sprint.baselineCount ?? 0} completed`}
            </Text>
          ))
        )}
        {history.status === "CanLoadMore" ? (
          <Button
            label="Load more"
            systemImage="arrow.down"
            onPress={() => history.loadMore(10)}
          />
        ) : null}
      </Section>
      <Section title="Settings">
        <Text>
          {`Default duration: ${durationLabel(context?.settings?.sprintDuration ?? 2)}`}
        </Text>
        <SegmentedPicker
          label="Default Sprint duration"
          options={durationOptions}
          value={
            String(context?.settings?.sprintDuration ?? 2) as DurationChoice
          }
          onChange={(value) =>
            void updateDuration({
              duration: value === "open" ? value : (Number(value) as 1 | 2 | 4),
            }).catch(showError)
          }
        />
      </Section>
    </Screen>
  )
}

function dateRange(startsAt: number, endsAt?: number) {
  const start = new Date(startsAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
  if (!endsAt) return `Started ${start} - no fixed end`
  const end = new Date(endsAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return `${start} - ${end}`
}

function durationLabel(value: 1 | 2 | 4 | "open") {
  return value === "open"
    ? "No fixed end"
    : `${value} week${value === 1 ? "" : "s"}`
}

function showError(error: unknown) {
  Alert.alert(
    "Sprint update failed",
    error instanceof Error ? error.message : "Try again."
  )
}
