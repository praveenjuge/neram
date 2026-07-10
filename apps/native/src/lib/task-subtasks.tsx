import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { useMutation, useQuery } from "convex/react"
import { useState } from "react"
import { Alert, Pressable, Text, View } from "react-native"

import {
  InlineMeta,
  NativeButton,
  NativeSection,
  NativeTextPrompt,
  taskStyles,
  useTaskColors,
} from "@/lib/task-ui"

export function NativeTaskSubtasks({ taskId }: { taskId: Id<"tasks"> }) {
  const colors = useTaskColors()
  const rows = useQuery(api.subtasks.list, { taskId })
  const create = useMutation(api.subtasks.create)
  const [adding, setAdding] = useState(false)

  return (
    <NativeSection
      detail="Completed items stay in their manual order. Reordering is available on web and CLI."
      title="Subtasks"
    >
      <NativeButton label="Add subtask" onPress={() => setAdding(true)} />
      <NativeTextPrompt
        detail="What needs to be done?"
        onClose={() => setAdding(false)}
        onSubmit={(value) => {
          const title = value.trim()
          if (!title) return
          setAdding(false)
          void create({ taskId, title }).catch(showError)
        }}
        submitLabel="Add"
        title="New subtask"
        visible={adding}
      />
      {rows === undefined ? (
        <InlineMeta>Loading subtasks…</InlineMeta>
      ) : rows.length === 0 ? (
        <InlineMeta>No subtasks yet.</InlineMeta>
      ) : (
        rows.map((row) => (
          <SubtaskRow key={row._id} row={row} />
        ))
      )}
      {rows?.length ? (
        <View style={taskStyles.row}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {rows.filter((row) => row.completed).length}/{rows.length} complete
          </Text>
        </View>
      ) : null}
    </NativeSection>
  )
}

function SubtaskRow({
  row,
}: {
  row: {
    _id: Id<"subtasks">
    title: string
    completed: boolean
  }
}) {
  const colors = useTaskColors()
  const setCompleted = useMutation(api.subtasks.setCompleted)
  const rename = useMutation(api.subtasks.rename)
  const remove = useMutation(api.subtasks.remove)
  const [renaming, setRenaming] = useState(false)

  function confirmDelete() {
    Alert.alert("Delete subtask?", row.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void remove({ subtaskId: row._id }).catch(showError),
      },
    ])
  }

  return (
    <View style={[taskStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: row.completed }}
        onPress={() =>
          void setCompleted({
            subtaskId: row._id,
            completed: !row.completed,
          }).catch(showError)
        }
      >
        <Text
          style={{
            color: row.completed ? colors.muted : colors.text,
            fontSize: 15,
            textDecorationLine: row.completed ? "line-through" : "none",
          }}
        >
          {row.completed ? "✓" : "○"} {row.title}
        </Text>
      </Pressable>
      <View style={taskStyles.row}>
        <NativeButton label="Rename" onPress={() => setRenaming(true)} />
        <NativeButton destructive label="Delete" onPress={confirmDelete} />
      </View>
      <NativeTextPrompt
        initialValue={row.title}
        onClose={() => setRenaming(false)}
        onSubmit={(value) => {
          const title = value.trim()
          if (!title) return
          setRenaming(false)
          void rename({ subtaskId: row._id, title }).catch(showError)
        }}
        title="Rename subtask"
        visible={renaming}
      />
    </View>
  )
}

function showError(error: unknown) {
  Alert.alert("Could not update subtask", error instanceof Error ? error.message : "Try again.")
}
