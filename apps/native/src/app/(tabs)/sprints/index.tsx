import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { useMutation, usePaginatedQuery, useQuery } from "convex/react"
import { router } from "expo-router"
import { useState } from "react"
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

const views = [
  ["current", "Current"],
  ["backlog", "Backlog"],
  ["upcoming", "Upcoming"],
  ["history", "History"],
  ["settings", "Settings"],
] as const

type View = (typeof views)[number][0]

export default function SprintsScreen() {
  const [view, setView] = useState<View>("current")
  const [selectedSprintId, setSelectedSprintId] =
    useState<Id<"sprints"> | null>(null)
  const current = useQuery(api.sprints.current)
  const backlog = useQuery(api.sprints.backlog)
  const upcoming = useQuery(api.sprints.upcoming)
  const context = useQuery(api.organizations.current)
  const history = usePaginatedQuery(
    api.sprints.history,
    {},
    { initialNumItems: 10 }
  )
  const audit = useQuery(
    api.sprints.audit,
    selectedSprintId
      ? {
          sprintId: selectedSprintId,
          paginationOpts: { numItems: 100, cursor: null },
        }
      : "skip"
  )
  const plan = useMutation(api.sprints.plan)
  const remove = useMutation(api.sprints.remove)
  const updateGoal = useMutation(api.sprints.updateGoal)
  const updateCadence = useMutation(api.sprints.updateCadence)
  const rollover = useMutation(api.sprints.rollover)

  const editGoal = (sprint: "current" | "upcoming", initial?: string) => {
    Alert.prompt(
      "Sprint goal",
      "Optional outcome for this Sprint.",
      (value?: string) => {
        void updateGoal({
          sprint,
          goal: (value ?? "").trim() || undefined,
        }).catch(showError)
      },
      "plain-text",
      initial
    )
  }

  const planTask = (taskId: Id<"tasks">) => {
    Alert.alert("Plan task", "Choose a Sprint.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Current",
        onPress: () =>
          void plan({ taskIds: [taskId], sprint: "current" }).catch(showError),
      },
      {
        text: "Upcoming",
        onPress: () =>
          void plan({ taskIds: [taskId], sprint: "upcoming" }).catch(showError),
      },
    ])
  }

  const manageTask = (
    task: {
      _id: Id<"tasks">
      projectId: Id<"projects">
      title: string
      status: string
    },
    sprint: "current" | "upcoming"
  ) => {
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
        onPress: () =>
          void remove({ taskIds: [task._id], sprint }).catch(showError),
      })
    }
    Alert.alert(task.title, undefined, actions)
  }

  const rollOverEarly = () => {
    if (!context) return
    Alert.prompt(
      "Roll over early",
      "Why is this Sprint closing early?",
      (value?: string) => {
        const reason = (value ?? "").trim()
        if (!reason) return
        Alert.alert(
          "Confirm rollover",
          "Unfinished work will carry forward. This is audited.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Roll over",
              style: "destructive",
              onPress: () =>
                void rollover({
                  organizationId: context.organization.organizationId,
                  slug: context.organization.slug,
                  confirm: true,
                  reason,
                }).catch(showError),
            },
          ]
        )
      }
    )
  }

  const cadence = context?.settings
  const updateCadenceField = (
    field: "weeks" | "weekday" | "timezone",
    title: string,
    initial: string
  ) => {
    Alert.prompt(
      title,
      undefined,
      (value?: string) => {
        const next = (value ?? "").trim()
        if (!next) return
        void updateCadence({
          cadenceWeeks:
            field === "weeks" ? Number(next) : (cadence?.cadenceWeeks ?? 2),
          startWeekday:
            field === "weekday" ? Number(next) : (cadence?.startWeekday ?? 1),
          timezone: field === "timezone" ? next : (cadence?.timezone ?? "UTC"),
        }).catch(showError)
      },
      "plain-text",
      initial
    )
  }

  return (
    <Screen>
      <Section title="View">
        <SegmentedPicker
          label="Sprint view"
          options={views}
          value={view}
          onChange={setView}
        />
      </Section>
      {view === "current" ? (
        <Section
          title={current ? `Sprint ${current.sprint.number}` : "Current"}
        >
          {current === undefined ? (
            <Text>Loading Current...</Text>
          ) : current === null ? (
            <Empty title="Current unavailable" />
          ) : (
            <>
              <Text>{current.sprint.goal || "No Sprint goal"}</Text>
              <Button
                label="Edit goal"
                systemImage="pencil"
                onPress={() => editGoal("current", current.sprint.goal)}
              />
              {current.tasks.length === 0 ? (
                <Empty
                  title="No Current tasks"
                  detail="Move Backlog work to In Progress or plan it here."
                />
              ) : (
                current.tasks.map((task) => (
                  <Row
                    key={task._id}
                    label={`${task.title} - ${task.projectName} - ${task.status}`}
                    systemImage={
                      task.status === "done" ? "checkmark.circle" : "circle"
                    }
                    onPress={() => manageTask(task, "current")}
                  />
                ))
              )}
              <Button
                label="Roll over early"
                systemImage="arrow.triangle.2.circlepath"
                onPress={rollOverEarly}
              />
            </>
          )}
        </Section>
      ) : null}
      {view === "backlog" ? (
        <Section title="Backlog">
          {backlog === undefined ? (
            <Text>Loading Backlog...</Text>
          ) : backlog.length === 0 ? (
            <Empty title="Backlog is empty" />
          ) : (
            backlog.map((task) => (
              <Row
                key={task._id}
                label={`${task.title} - ${task.projectName}`}
                systemImage="text.badge.plus"
                onPress={() => planTask(task._id)}
              />
            ))
          )}
        </Section>
      ) : null}
      {view === "upcoming" ? (
        <Section
          title={upcoming ? `Sprint ${upcoming.sprint.number}` : "Upcoming"}
        >
          {upcoming === undefined ? (
            <Text>Loading Upcoming...</Text>
          ) : upcoming === null ? (
            <Empty title="Upcoming unavailable" />
          ) : (
            <>
              <Text>{upcoming.sprint.goal || "No Sprint goal"}</Text>
              <Button
                label="Edit goal"
                systemImage="pencil"
                onPress={() => editGoal("upcoming", upcoming.sprint.goal)}
              />
              {upcoming.tasks.map((task) => (
                <Row
                  key={task._id}
                  label={`${task.title} - ${task.projectName}`}
                  systemImage="calendar"
                  onPress={() => manageTask(task, "upcoming")}
                />
              ))}
            </>
          )}
        </Section>
      ) : null}
      {view === "history" ? (
        <Section title="History">
          {history.status === "LoadingFirstPage" ? (
            <Text>Loading history...</Text>
          ) : history.results.length === 0 ? (
            <Empty title="No closed Sprints" />
          ) : (
            history.results.map((sprint) => (
              <Row
                key={sprint._id}
                label={`Sprint ${sprint.number} - ${sprint.completedCount ?? 0} completed - ${sprint.carriedCount ?? 0} carried - ${sprint.addedCount ?? 0} added`}
                systemImage={
                  selectedSprintId === sprint._id
                    ? "checkmark.circle"
                    : "clock.arrow.circlepath"
                }
                onPress={() => setSelectedSprintId(sprint._id)}
              />
            ))
          )}
          {history.status === "CanLoadMore" ? (
            <Button
              label="Load more"
              systemImage="arrow.down"
              onPress={() => history.loadMore(10)}
            />
          ) : null}
          {selectedSprintId ? (
            audit === undefined ? (
              <Text>Loading scope audit...</Text>
            ) : audit.page.length === 0 ? (
              <Empty title="No scope changes" />
            ) : (
              audit.page.map((entry) => (
                <Text key={entry._id}>
                  {`${entry.taskTitleSnapshot} - ${entry.projectNameSnapshot} - ${entry.origin.replace("_", " ")}${entry.removedAt ? " - removed" : ""}`}
                </Text>
              ))
            )
          ) : null}
        </Section>
      ) : null}
      {view === "settings" ? (
        <Section title="Cadence">
          <Row
            label={`${cadence?.cadenceWeeks ?? 2} week cadence`}
            systemImage="calendar.badge.clock"
            onPress={() =>
              updateCadenceField(
                "weeks",
                "Cadence weeks (1-8)",
                String(cadence?.cadenceWeeks ?? 2)
              )
            }
          />
          <Row
            label={`Start weekday ${cadence?.startWeekday ?? 1}`}
            systemImage="calendar"
            onPress={() =>
              updateCadenceField(
                "weekday",
                "Start weekday (0-6)",
                String(cadence?.startWeekday ?? 1)
              )
            }
          />
          <Row
            label={cadence?.timezone ?? "UTC"}
            systemImage="globe"
            onPress={() =>
              updateCadenceField(
                "timezone",
                "IANA timezone",
                cadence?.timezone ?? "UTC"
              )
            }
          />
          <Button
            label="Manage members"
            systemImage="person.2"
            onPress={() => router.push("/workspace")}
          />
        </Section>
      ) : null}
    </Screen>
  )
}

function showError(error: unknown) {
  Alert.alert(
    "Sprint update failed",
    error instanceof Error ? error.message : "Try again."
  )
}
