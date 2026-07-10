import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native"

import { NativeTaskComments } from "@/lib/task-comments"
import { NativeTaskSubtasks } from "@/lib/task-subtasks"
import {
  InlineMeta,
  NativeButton,
  NativeSection,
  taskStyles,
  useTaskColors,
} from "@/lib/task-ui"

type Status = "todo" | "inProgress" | "done"
const statuses: [Status, string][] = [
  ["todo", "To do"],
  ["inProgress", "In progress"],
  ["done", "Done"],
]

export default function TaskScreen() {
  const { taskId, commentId } = useLocalSearchParams<{
    taskId: string
    commentId?: string
  }>()
  const id = taskId as Id<"tasks">
  const task = useQuery(api.tasks.get, { taskId: id })
  const colors = useTaskColors()

  return (
    <SafeAreaView style={[taskStyles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: task?.title ?? "Task" }} />
      {task === undefined ? (
        <View style={taskStyles.content}><InlineMeta>Loading task…</InlineMeta></View>
      ) : task === null ? (
        <View style={taskStyles.content}>
          <NativeSection title="Task unavailable" detail="It was deleted, moved somewhere you cannot access, or the link is invalid.">
            <NativeButton label="Go back" onPress={() => router.back()} />
          </NativeSection>
        </View>
      ) : (
        <ScrollView contentContainerStyle={taskStyles.content} keyboardShouldPersistTaps="handled">
          <TaskFields task={task} />
          <TaskMetadata task={task} />
          <NativeTaskSubtasks taskId={task._id} />
          <NativeTaskComments
            projectId={task.projectId}
            targetCommentId={commentId as Id<"taskComments"> | undefined}
            taskId={task._id}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

type Task = NonNullable<FunctionReturnType<typeof api.tasks.get>>

function TaskFields({ task }: { task: Task }) {
  const colors = useTaskColors()
  const update = useMutation(api.tasks.update)

  function editTitle() {
    Alert.prompt("Edit title", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Save",
        onPress: (value?: string) => {
          const title = (value ?? "").trim()
          if (title) void saveWithConflict("title", title)
        },
      },
    ], "plain-text", task.title)
  }

  function editDescription() {
    Alert.prompt("Edit description", "Leave empty to clear it.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Save",
        onPress: (value?: string) => void saveWithConflict("description", value ?? ""),
      },
    ], "plain-text", task.description ?? "")
  }

  async function saveWithConflict(field: "title" | "description", value: string) {
    const args = field === "title"
      ? { taskId: task._id, title: value, expectedTitle: task.title }
      : {
          taskId: task._id,
          description: value,
          expectedDescription: task.description ?? null,
        }
    try {
      await update(args)
    } catch (error) {
      const data = convexData(error)
      if (data?.code !== "EDIT_CONFLICT") {
        return showError("Could not update task", error)
      }
      const latest = String(data.latestValue ?? "")
      Alert.alert("This field changed", "Choose which value to keep.", [
        { text: "Use latest", style: "cancel" },
        {
          text: "Keep mine",
          onPress: () =>
            void update(
              field === "title"
                ? { taskId: task._id, title: value, expectedTitle: latest }
                : {
                    taskId: task._id,
                    description: value,
                    expectedDescription: latest || null,
                  }
            ).catch((retryError) => showError("Could not update task", retryError)),
        },
      ])
    }
  }

  return (
    <NativeSection detail="Tap either field to edit it." title="Task">
      <Pressable onPress={editTitle}>
        <Text style={[taskStyles.title, { color: colors.text }]}>{task.title}</Text>
      </Pressable>
      <Pressable onPress={editDescription}>
        <Text style={[taskStyles.body, { color: task.description ? colors.text : colors.muted }]}>
          {task.description || "Add a description"}
        </Text>
      </Pressable>
    </NativeSection>
  )
}

function TaskMetadata({ task }: { task: Task }) {
  const colors = useTaskColors()
  const update = useMutation(api.tasks.update)
  const move = useMutation(api.tasks.move)
  const changeProject = useMutation(api.tasks.changeProject)
  const remove = useMutation(api.tasks.remove)
  const projects = useQuery(api.projects.names, {})
  const members = useQuery(api.members.list, { projectId: task.projectId })
  const [projectSheet, setProjectSheet] = useState(false)
  const [assigneeSheet, setAssigneeSheet] = useState(false)

  async function changeStatus(status: Status) {
    try {
      await move({ taskId: task._id, status })
    } catch (error) {
      const data = convexData(error)
      if (data?.code !== "INCOMPLETE_SUBTASKS") {
        return showError("Could not move task", error)
      }
      Alert.alert(
        "Unfinished subtasks",
        `${String(data.unfinishedCount)} subtasks are unfinished. Mark this task Done anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Mark Done",
            onPress: () =>
              void move({
                taskId: task._id,
                status,
                confirmIncompleteSubtasks: true,
              }).catch((retryError) => showError("Could not move task", retryError)),
          },
        ]
      )
    }
  }

  function editDueDate() {
    Alert.prompt("Due date", "Use YYYY-MM-DD, or leave empty to clear.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Save",
        onPress: (value?: string) =>
          void update({ taskId: task._id, dueDate: value ?? "" }).catch((error) =>
            showError("Could not update due date", error)
          ),
      },
    ], "plain-text", task.dueDate ?? "")
  }

  function confirmDelete() {
    Alert.alert(
      "Delete task?",
      `This also removes ${task.totalSubtasks} subtasks and ${task.activeCommentCount} active comments.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void remove({ taskId: task._id, confirmCascade: true })
              .then(() => router.back())
              .catch((error) => showError("Could not delete task", error)),
        },
      ]
    )
  }

  return (
    <NativeSection title="Details">
      <View style={taskStyles.row}>
        {statuses.map(([status, label]) => (
          <NativeButton active={task.status === status} key={status} label={label} onPress={() => void changeStatus(status)} />
        ))}
      </View>
      <NativeButton label={`Project · ${projects?.find((project) => project._id === task.projectId)?.name ?? "Loading"}`} onPress={() => setProjectSheet(true)} />
      <NativeButton label={`Due · ${task.dueDate ?? "None"}`} onPress={editDueDate} />
      <NativeButton label={`Assignee · ${task.assigneeName ?? "Unassigned"}`} onPress={() => setAssigneeSheet(true)} />
      <View style={[taskStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <InlineMeta>{task.completedSubtasks}/{task.totalSubtasks} subtasks complete · {task.activeCommentCount} comments</InlineMeta>
        <InlineMeta>Created {new Date(task.createdAt).toLocaleString()}</InlineMeta>
        <InlineMeta>Updated {new Date(task.updatedAt).toLocaleString()}</InlineMeta>
      </View>
      <NativeButton destructive label="Delete task" onPress={confirmDelete} />
      <ChoiceSheet
        onClose={() => setProjectSheet(false)}
        title="Move to project"
        visible={projectSheet}
        choices={(projects ?? []).map((project) => ({ id: project._id, label: project.name }))}
        onChoose={(projectId) =>
          void changeProject({
            taskId: task._id,
            projectId: projectId as Id<"projects">,
          })
            .then(() => setProjectSheet(false))
            .catch((error) => showError("Could not move task", error))
        }
      />
      <ChoiceSheet
        onClose={() => setAssigneeSheet(false)}
        title="Assign task"
        visible={assigneeSheet}
        choices={[
          { id: "", label: "Unassigned" },
          ...(members ?? []).map((member) => ({ id: member.subject, label: member.displayName })),
        ]}
        onChoose={(subject) =>
          void update({
            taskId: task._id,
            assigneeSubject: subject,
          })
            .then(() => setAssigneeSheet(false))
            .catch((error) => showError("Could not assign task", error))
        }
      />
    </NativeSection>
  )
}

function ChoiceSheet({
  title,
  choices,
  visible,
  onClose,
  onChoose,
}: {
  title: string
  choices: { id: string; label: string }[]
  visible: boolean
  onClose: () => void
  onChoose: (id: string) => void
}) {
  const colors = useTaskColors()
  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView style={[taskStyles.screen, { backgroundColor: colors.background }]}>
        <View style={taskStyles.content}>
          <View style={taskStyles.between}>
            <Text style={[taskStyles.sectionTitle, { color: colors.text }]}>{title}</Text>
            <NativeButton label="Close" onPress={onClose} />
          </View>
          {choices.map((choice) => (
            <NativeButton key={choice.id || "none"} label={choice.label} onPress={() => onChoose(choice.id)} />
          ))}
        </View>
      </SafeAreaView>
    </Modal>
  )
}

function convexData(error: unknown) {
  if (
    !(error instanceof ConvexError) &&
    (typeof error !== "object" || error === null || !("data" in error))
  ) return null
  return (error as { data: Record<string, unknown> }).data
}

function showError(title: string, error: unknown) {
  Alert.alert(title, error instanceof Error ? error.message : "Try again.")
}
