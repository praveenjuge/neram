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
import { cadenceUpdate } from "@/lib/sprint-workspace"

const views = [
  ["current", "Current"],
  ["backlog", "Backlog"],
  ["upcoming", "Upcoming"],
  ["history", "History"],
  ["settings", "Settings"],
] as const

type View = (typeof views)[number][0]

// The active Sprint, the soonest scheduled one, or a specific scheduled Sprint.
type SprintTarget = "current" | "upcoming" | Id<"sprints">

function sprintName(sprint: { name?: string; number: number }) {
  return sprint.name?.trim() || `Sprint ${sprint.number}`
}

export default function SprintsScreen() {
  const [view, setView] = useState<View>("current")
  const [selectedSprintId, setSelectedSprintId] =
    useState<Id<"sprints"> | null>(null)
  const current = useQuery(api.sprints.current)
  const backlog = useQuery(api.sprints.backlog)
  const upcomingList = useQuery(api.sprints.upcomingList)
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
  const schedule = useMutation(api.sprints.scheduleSprint)
  const unschedule = useMutation(api.sprints.unscheduleSprint)
  const renameSprintMutation = useMutation(api.sprints.renameSprint)

  const editGoal = (sprint: SprintTarget, initial?: string) => {
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
    const actions: {
      text: string
      style?: "cancel" | "destructive"
      onPress?: () => void
    }[] = [
      { text: "Cancel", style: "cancel" },
      {
        text: "Current",
        onPress: () =>
          void plan({ taskIds: [taskId], sprint: "current" }).catch(showError),
      },
    ]
    for (const entry of upcomingList ?? []) {
      actions.push({
        text: `Sprint ${entry.sprint.number}`,
        onPress: () =>
          void plan({ taskIds: [taskId], sprint: entry.sprint._id }).catch(
            showError
          ),
      })
    }
    Alert.alert("Plan task", "Choose a Sprint.", actions)
  }

  const scheduleSprint = () => {
    const list = upcomingList ?? []
    const nextNumber =
      list.length > 0 ? list[list.length - 1].sprint.number + 1 : 1
    const fallback = `Sprint ${nextNumber}`
    Alert.prompt(
      "New Sprint",
      "Name your Sprint.",
      (value?: string) => {
        void schedule({ name: (value ?? "").trim() || fallback }).catch(
          showError
        )
      },
      "plain-text",
      fallback
    )
  }

  const renameSprint = (sprint: SprintTarget, initial: string) => {
    Alert.prompt(
      "Rename Sprint",
      "Update this Sprint's name.",
      (value?: string) => {
        void renameSprintMutation({
          sprint,
          name: (value ?? "").trim() || undefined,
        }).catch(showError)
      },
      "plain-text",
      initial
    )
  }

  const unscheduleSprint = (sprintId: Id<"sprints">) => {
    Alert.alert("Remove Sprint", "Planned work returns to the Backlog.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void unschedule({ sprintId }).catch(showError),
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
    sprint: SprintTarget
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
        void updateCadence(
          cadenceUpdate(
            {
              cadenceWeeks: cadence?.cadenceWeeks ?? 2,
              startWeekday: cadence?.startWeekday ?? 1,
              timezone: cadence?.timezone ?? "UTC",
            },
            field,
            next
          )
        ).catch(showError)
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
        <Section title={current ? sprintName(current.sprint) : "Current"}>
          {current === undefined ? (
            <Text>Loading Current...</Text>
          ) : current === null ? (
            <>
              <Empty
                title="No active Sprint"
                detail="Create one to start planning."
              />
              <Button
                label="New Sprint"
                systemImage="calendar.badge.plus"
                onPress={scheduleSprint}
              />
            </>
          ) : (
            <>
              <Text>{current.sprint.goal || "No Sprint goal"}</Text>
              <Button
                label="Rename Sprint"
                systemImage="square.and.pencil"
                onPress={() =>
                  renameSprint("current", sprintName(current.sprint))
                }
              />
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
        <>
          <Section title="Upcoming">
            <Button
              label="Schedule Sprint"
              systemImage="calendar.badge.plus"
              onPress={scheduleSprint}
            />
            {upcomingList === undefined ? (
              <Text>Loading Upcoming...</Text>
            ) : upcomingList.length === 0 ? (
              <Empty
                title="No upcoming Sprints"
                detail="Schedule one to plan ahead."
              />
            ) : null}
          </Section>
          {(upcomingList ?? []).map((entry) => (
            <Section key={entry.sprint._id} title={sprintName(entry.sprint)}>
              <Text>{entry.sprint.goal || "No Sprint goal"}</Text>
              <Button
                label="Rename Sprint"
                systemImage="square.and.pencil"
                onPress={() =>
                  renameSprint(entry.sprint._id, sprintName(entry.sprint))
                }
              />
              <Button
                label="Edit goal"
                systemImage="pencil"
                onPress={() => editGoal(entry.sprint._id, entry.sprint.goal)}
              />
              {entry.tasks.map((task) => (
                <Row
                  key={task._id}
                  label={`${task.title} - ${task.projectName}`}
                  systemImage="calendar"
                  onPress={() => manageTask(task, entry.sprint._id)}
                />
              ))}
              <Button
                label="Remove this Sprint"
                systemImage="trash"
                onPress={() => unscheduleSprint(entry.sprint._id)}
              />
            </Section>
          ))}
        </>
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
