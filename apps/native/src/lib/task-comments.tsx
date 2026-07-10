import AsyncStorage from "@react-native-async-storage/async-storage"
import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { useMutation, usePaginatedQuery, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useEffect, useMemo, useState } from "react"
import { Alert, Text, View } from "react-native"

import {
  InlineMeta,
  NativeButton,
  NativeField,
  NativeSection,
  taskStyles,
  useTaskColors,
} from "@/lib/task-ui"

type Comment = FunctionReturnType<typeof api.taskComments.list>["page"][number]
type Member = FunctionReturnType<typeof api.members.list>[number]
type Mention = Comment["mentions"][number]

export function NativeTaskComments({
  taskId,
  projectId,
  targetCommentId,
}: {
  taskId: Id<"tasks">
  projectId: Id<"projects">
  targetCommentId?: Id<"taskComments">
}) {
  const members = useQuery(api.members.list, { projectId })
  const current = members?.find((member) => member.isYou)
  const create = useMutation(api.taskComments.create)
  return (
    <NativeSection
      detail="Replies stay attached to their parent. Indentation stops after three levels."
      title="Comments"
    >
      <CommentComposer
        draftKey={draftKey(taskId)}
        members={members ?? []}
        onSubmit={async (payload) => {
          await create({ taskId, ...payload })
        }}
        placeholder="Write a comment"
      />
      {targetCommentId ? (
        <NativeLinkedThread
          currentSubject={current?.subject}
          isOwner={current?.role === "owner"}
          members={members ?? []}
          targetCommentId={targetCommentId}
          taskId={taskId}
        />
      ) : null}
      <NativeCommentBranch
        currentSubject={current?.subject}
        depth={0}
        isOwner={current?.role === "owner"}
        members={members ?? []}
        targetCommentId={targetCommentId}
        taskId={taskId}
      />
    </NativeSection>
  )
}

function NativeCommentBranch({
  taskId,
  parentCommentId,
  depth,
  members,
  currentSubject,
  isOwner,
  targetCommentId,
}: {
  taskId: Id<"tasks">
  parentCommentId?: Id<"taskComments">
  depth: number
  members: Member[]
  currentSubject?: string
  isOwner: boolean
  targetCommentId?: Id<"taskComments">
}) {
  const feed = usePaginatedQuery(
    api.taskComments.list,
    { taskId, parentCommentId },
    { initialNumItems: parentCommentId ? 10 : 20 }
  )
  if (feed.status === "LoadingFirstPage") return <InlineMeta>Loading comments…</InlineMeta>
  if (!parentCommentId && feed.results.length === 0) return <InlineMeta>No comments yet.</InlineMeta>
  return (
    <View style={{ gap: 10 }}>
      {feed.results.map((comment) => (
        <NativeCommentNode
          comment={comment}
          currentSubject={currentSubject}
          depth={depth}
          isOwner={isOwner}
          key={comment._id}
          members={members}
          targetCommentId={targetCommentId}
        />
      ))}
      {feed.status === "CanLoadMore" || feed.status === "LoadingMore" ? (
        <NativeButton
          disabled={feed.status === "LoadingMore"}
          label={feed.status === "LoadingMore" ? "Loading…" : "Load more"}
          onPress={() => feed.loadMore(parentCommentId ? 10 : 20)}
        />
      ) : null}
    </View>
  )
}

function NativeCommentNode({
  comment,
  depth,
  members,
  currentSubject,
  isOwner,
  targetCommentId,
}: {
  comment: Comment
  depth: number
  members: Member[]
  currentSubject?: string
  isOwner: boolean
  targetCommentId?: Id<"taskComments">
}) {
  const colors = useTaskColors()
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(comment._id === targetCommentId)
  const reply = useMutation(api.taskComments.reply)
  const edit = useMutation(api.taskComments.edit)
  const remove = useMutation(api.taskComments.remove)
  const canEdit = !comment.deletedAt && currentSubject === comment.authorSubject
  const canDelete = !comment.deletedAt && (canEdit || isOwner)

  function confirmDelete() {
    Alert.alert("Delete comment?", "Replies will remain in the thread.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void remove({ commentId: comment._id }).catch(showCommentError),
      },
    ])
  }

  return (
    <View
      style={[
        taskStyles.card,
        {
          marginLeft: Math.min(depth, 3) * 12,
          borderLeftWidth: depth ? 2 : 0.5,
          borderColor: comment._id === targetCommentId ? colors.accent : colors.border,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={taskStyles.between}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
          {comment.authorName}
        </Text>
        <InlineMeta>
          {comment.updatedAt > comment.createdAt && !comment.deletedAt ? "edited" : ""}
        </InlineMeta>
      </View>
      {editing ? (
        <CommentComposer
          initialBody={comment.body}
          initialMentions={comment.mentions}
          members={members}
          onCancel={() => setEditing(false)}
          onSubmit={async (payload) => {
            await edit({ commentId: comment._id, ...payload })
            setEditing(false)
          }}
          placeholder="Edit comment"
        />
      ) : (
        <Text style={[taskStyles.body, { color: comment.deletedAt ? colors.muted : colors.text, fontStyle: comment.deletedAt ? "italic" : "normal" }]}>
          {comment.deletedAt ? "Comment deleted" : comment.body}
        </Text>
      )}
      <View style={taskStyles.row}>
        <NativeButton label="Reply" onPress={() => setReplying((value) => !value)} />
        <NativeButton label={expanded ? "Hide replies" : "Show replies"} onPress={() => setExpanded((value) => !value)} />
        {canEdit ? <NativeButton label="Edit" onPress={() => setEditing(true)} /> : null}
        {canDelete ? <NativeButton destructive label="Delete" onPress={confirmDelete} /> : null}
      </View>
      {replying ? (
        <View style={{ gap: 6 }}>
          <InlineMeta>Replying to {comment.authorName}</InlineMeta>
          <CommentComposer
            draftKey={draftKey(comment.taskId, comment._id)}
            members={members}
            onCancel={() => setReplying(false)}
            onSubmit={async (payload) => {
              await reply({ commentId: comment._id, ...payload })
              setReplying(false)
              setExpanded(true)
            }}
            placeholder={`Reply to ${comment.authorName}`}
          />
        </View>
      ) : null}
      {expanded ? (
        <NativeCommentBranch
          currentSubject={currentSubject}
          depth={depth + 1}
          isOwner={isOwner}
          members={members}
          parentCommentId={comment._id}
          targetCommentId={targetCommentId}
          taskId={comment.taskId}
        />
      ) : null}
    </View>
  )
}

function NativeLinkedThread({
  taskId,
  targetCommentId,
  members,
  currentSubject,
  isOwner,
}: {
  taskId: Id<"tasks">
  targetCommentId: Id<"taskComments">
  members: Member[]
  currentSubject?: string
  isOwner: boolean
}) {
  const result = useQuery(api.taskComments.getAncestry, {
    commentId: targetCommentId,
    limit: 100,
  })
  if (!result) return <InlineMeta>Loading linked comment…</InlineMeta>
  if (result.taskId !== taskId) return <InlineMeta>Linked comment unavailable.</InlineMeta>
  return (
    <View style={{ gap: 8 }}>
      <InlineMeta>Linked thread</InlineMeta>
      {result.nextCommentId ? (
        <NativeOlderAncestry
          currentSubject={currentSubject}
          isOwner={isOwner}
          members={members}
          startCommentId={result.nextCommentId}
          targetCommentId={targetCommentId}
        />
      ) : null}
      {result.comments.map((comment, index) => (
        <NativeCommentNode
          comment={comment}
          currentSubject={currentSubject}
          depth={index}
          isOwner={isOwner}
          key={comment._id}
          members={members}
          targetCommentId={targetCommentId}
        />
      ))}
    </View>
  )
}

function NativeOlderAncestry({
  targetCommentId,
  startCommentId,
  members,
  currentSubject,
  isOwner,
}: {
  targetCommentId: Id<"taskComments">
  startCommentId: Id<"taskComments">
  members: Member[]
  currentSubject?: string
  isOwner: boolean
}) {
  const result = useQuery(api.taskComments.getAncestry, {
    commentId: targetCommentId,
    startCommentId,
    limit: 100,
  })
  if (!result) return <InlineMeta>Loading older ancestry…</InlineMeta>
  return (
    <View style={{ gap: 8 }}>
      {result.nextCommentId ? (
        <NativeOlderAncestry
          currentSubject={currentSubject}
          isOwner={isOwner}
          members={members}
          startCommentId={result.nextCommentId}
          targetCommentId={targetCommentId}
        />
      ) : null}
      {result.comments.map((comment, index) => (
        <NativeCommentNode
          comment={comment}
          currentSubject={currentSubject}
          depth={index}
          isOwner={isOwner}
          key={comment._id}
          members={members}
          targetCommentId={targetCommentId}
        />
      ))}
    </View>
  )
}

function CommentComposer({
  members,
  onSubmit,
  placeholder,
  draftKey: storageKey,
  initialBody = "",
  initialMentions = [],
  onCancel,
}: {
  members: Member[]
  onSubmit: (payload: { body: string; mentions: Mention[] }) => Promise<void>
  placeholder: string
  draftKey?: string
  initialBody?: string
  initialMentions?: Mention[]
  onCancel?: () => void
}) {
  const [body, setBody, clearDraft] = useStoredDraft(storageKey, initialBody)
  const [tokens, setTokens] = useState(() => initialMentions.map(({ subject, label }) => ({ subject, label })))
  const [busy, setBusy] = useState(false)
  const query = /(?:^|\s)@([^\s@]*)$/.exec(body)?.[1].toLowerCase()
  const suggestions = useMemo(
    () =>
      query === undefined
        ? []
        : members.filter((member) => member.displayName.toLowerCase().includes(query)).slice(0, 6),
    [members, query]
  )

  function selectMention(member: Member) {
    const next = body.replace(/(?:^|\s)@[^\s@]*$/, (match) => `${match.startsWith(" ") ? " " : ""}@${member.displayName} `)
    setBody(next)
    setTokens((value) => [...value, { subject: member.subject, label: member.displayName }])
  }

  async function submit() {
    if (!body.trim() || busy) return
    let offset = 0
    const mentions: Mention[] = []
    for (const token of tokens) {
      const text = `@${token.label}`
      const start = body.indexOf(text, offset)
      if (start < 0) continue
      mentions.push({ ...token, start, length: text.length })
      offset = start + text.length
    }
    setBusy(true)
    try {
      await onSubmit({ body, mentions })
      await clearDraft()
      setTokens([])
    } catch (error) {
      showCommentError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <NativeField
        maxLength={5000}
        multiline
        onChangeText={setBody}
        placeholder={placeholder}
        value={body}
      />
      {suggestions.length ? (
        <View style={taskStyles.row}>
          {suggestions.map((member) => (
            <NativeButton key={member.subject} label={`@${member.displayName}`} onPress={() => selectMention(member)} />
          ))}
        </View>
      ) : null}
      <View style={taskStyles.row}>
        {onCancel ? <NativeButton label="Cancel" onPress={onCancel} /> : null}
        {storageKey && body ? <NativeButton label="Discard draft" onPress={() => void clearDraft()} /> : null}
        <NativeButton active disabled={busy || !body.trim()} label={busy ? "Posting…" : "Post"} onPress={() => void submit()} />
      </View>
    </View>
  )
}

function useStoredDraft(key: string | undefined, initialValue: string) {
  const [value, setValue] = useState(initialValue)
  useEffect(() => {
    if (!key) return
    void AsyncStorage.getItem(key).then((stored) => {
      if (stored !== null) setValue(stored)
    })
  }, [key])
  useEffect(() => {
    if (!key) return
    const timeout = setTimeout(() => {
      if (value) void AsyncStorage.setItem(key, value)
      else void AsyncStorage.removeItem(key)
    }, 200)
    return () => clearTimeout(timeout)
  }, [key, value])
  async function clear() {
    setValue("")
    if (key) await AsyncStorage.removeItem(key)
  }
  return [value, setValue, clear] as const
}

function draftKey(taskId: Id<"tasks">, parentCommentId?: Id<"taskComments">) {
  return `neram:comment-draft:${taskId}:${parentCommentId ?? "root"}`
}

function showCommentError(error: unknown) {
  Alert.alert("Could not save comment", error instanceof Error ? error.message : "Try again.")
}
