"use client"

import { useQuery } from "convex-helpers/react/cache"
import { useMutation, usePaginatedQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  ChevronDown,
  MessageSquareReply,
  Pencil,
  Send,
  Trash2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { cn } from "@/lib/utils"
import { messageFromError } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"
import { useOrganizationMembers } from "@/lib/use-organization-members"

type Comment = FunctionReturnType<typeof api.taskComments.list>["page"][number]
type Member = FunctionReturnType<
  typeof api.organizations.members
>["page"][number]
type Mention = Comment["mentions"][number]

export function TaskComments({
  taskId,
  targetCommentId,
}: {
  taskId: Id<"tasks">
  targetCommentId: Id<"taskComments"> | null
}) {
  const { members } = useOrganizationMembers()
  const context = useQuery(api.organizations.current)
  const create = useMutation(api.taskComments.create)
  const currentSubject = context?.membership.userId
  const isAdmin = context?.membership.role === "org:admin"

  return (
    <section className="grid gap-3" data-testid="task-comments">
      <CommentComposer
        members={members}
        onSubmit={async (payload) => {
          await create({ taskId, ...payload })
        }}
        placeholder="Write a comment…"
      />
      {targetCommentId ? (
        <LinkedThread
          currentSubject={currentSubject}
          isAdmin={isAdmin}
          members={members}
          targetCommentId={targetCommentId}
          taskId={taskId}
        />
      ) : null}
      <CommentBranch
        currentSubject={currentSubject}
        depth={0}
        isAdmin={isAdmin}
        members={members}
        taskId={taskId}
        targetCommentId={targetCommentId}
      />
    </section>
  )
}

function CommentBranch({
  taskId,
  parentCommentId,
  depth,
  members,
  currentSubject,
  isAdmin,
  targetCommentId,
}: {
  taskId: Id<"tasks">
  parentCommentId?: Id<"taskComments">
  depth: number
  members: Member[]
  currentSubject?: string
  isAdmin: boolean
  targetCommentId: Id<"taskComments"> | null
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.taskComments.list,
    { taskId, parentCommentId },
    { initialNumItems: parentCommentId ? 10 : 20 }
  )
  const isRoot = !parentCommentId
  if (status === "LoadingFirstPage") {
    return isRoot ? (
      <p className="text-sm text-muted-foreground">Loading comments…</p>
    ) : null
  }
  if (results.length === 0) {
    return isRoot ? (
      <p className="text-sm text-muted-foreground">No comments yet.</p>
    ) : null
  }
  return (
    <div className={cn("grid gap-2", depth > 0 && "mt-2 border-l pl-3")}>
      {results.map((comment) => (
        <CommentNode
          comment={comment}
          currentSubject={currentSubject}
          depth={depth}
          isAdmin={isAdmin}
          key={comment._id}
          members={members}
          targetCommentId={targetCommentId}
        />
      ))}
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          className="w-fit"
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(parentCommentId ? 10 : 20)}
          size="sm"
          variant="ghost"
        >
          <ChevronDown /> {status === "LoadingMore" ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  )
}

function CommentNode({
  comment,
  depth,
  members,
  currentSubject,
  isAdmin,
  targetCommentId,
  renderReplies = true,
}: {
  comment: Comment
  depth: number
  members: Member[]
  currentSubject?: string
  isAdmin: boolean
  targetCommentId: Id<"taskComments"> | null
  renderReplies?: boolean
}) {
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const reply = useMutation(api.taskComments.reply)
  const edit = useMutation(api.taskComments.edit)
  const remove = useMutation(api.taskComments.remove)
  const canEdit = !comment.deletedAt && comment.authorSubject === currentSubject
  const canDelete = !comment.deletedAt && (canEdit || isAdmin)
  const highlighted = comment._id === targetCommentId

  return (
    <article
      className={cn(
        "group/comment scroll-mt-8 rounded-lg px-2 py-1.5 transition-colors",
        highlighted && "bg-primary/5 ring-2 ring-primary/25"
      )}
      id={`comment-${comment._id}`}
      style={{ marginLeft: `${Math.min(depth, 3) * 12}px` }}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <UserAvatar className="size-6" name={comment.authorName} />
          <span className="truncate font-medium text-foreground">
            {comment.authorName}
          </span>
          {comment.updatedAt > comment.createdAt && !comment.deletedAt ? (
            <span className="shrink-0">· edited</span>
          ) : null}
        </div>
        {!comment.deletedAt ? (
          <div className="flex gap-1 opacity-0 transition-opacity group-focus-within/comment:opacity-100 group-hover/comment:opacity-100 max-md:opacity-100">
            {canEdit ? (
              <Button
                aria-label="Edit comment"
                onClick={() => setEditing(true)}
                size="icon-sm"
                variant="ghost"
              >
                <Pencil />
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                aria-label="Delete comment"
                onClick={() => void remove({ commentId: comment._id })}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>
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
        />
      ) : (
        <p
          className={cn(
            "mt-2 text-sm whitespace-pre-wrap",
            comment.deletedAt && "text-muted-foreground italic"
          )}
        >
          {comment.deletedAt ? "Comment deleted" : comment.body}
        </p>
      )}
      <div className="mt-1 flex gap-1">
        <Button
          onClick={() => setReplying((value) => !value)}
          size="sm"
          variant="outline"
        >
          <MessageSquareReply /> Reply
        </Button>
      </div>
      {replying ? (
        <div className="mt-2">
          <CommentComposer
            autoFocus
            members={members}
            onCancel={() => setReplying(false)}
            onSubmit={async (payload) => {
              await reply({ commentId: comment._id, ...payload })
              setReplying(false)
            }}
            placeholder={`Reply to ${comment.authorName}…`}
          />
        </div>
      ) : null}
      {renderReplies ? (
        <CommentBranch
          currentSubject={currentSubject}
          depth={depth + 1}
          isAdmin={isAdmin}
          members={members}
          parentCommentId={comment._id}
          targetCommentId={targetCommentId}
          taskId={comment.taskId}
        />
      ) : null}
    </article>
  )
}

function LinkedThread({
  taskId,
  targetCommentId,
  members,
  currentSubject,
  isAdmin,
}: {
  taskId: Id<"tasks">
  targetCommentId: Id<"taskComments">
  members: Member[]
  currentSubject?: string
  isAdmin: boolean
}) {
  const result = useQuery(api.taskComments.getAncestry, {
    commentId: targetCommentId,
    limit: 100,
  })
  useEffect(() => {
    if (!result) return
    const timer = window.setTimeout(() => {
      document.getElementById(`comment-${targetCommentId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [result, targetCommentId])
  if (!result)
    return (
      <p className="text-sm text-muted-foreground">Loading linked thread…</p>
    )
  if (result.taskId !== taskId) {
    return (
      <p className="text-sm text-muted-foreground">
        Linked comment unavailable.
      </p>
    )
  }
  return (
    <aside className="grid gap-2 rounded-lg bg-muted/40 p-3">
      <p className="text-sm font-medium text-muted-foreground">Linked thread</p>
      {result.nextCommentId ? (
        <OlderAncestry
          currentSubject={currentSubject}
          isAdmin={isAdmin}
          members={members}
          startCommentId={result.nextCommentId}
          targetCommentId={targetCommentId}
        />
      ) : null}
      {result.comments.map((comment, index) => (
        <CommentNode
          comment={comment}
          currentSubject={currentSubject}
          depth={index}
          isAdmin={isAdmin}
          key={comment._id}
          members={members}
          renderReplies={comment._id === targetCommentId}
          targetCommentId={targetCommentId}
        />
      ))}
    </aside>
  )
}

function OlderAncestry({
  targetCommentId,
  startCommentId,
  members,
  currentSubject,
  isAdmin,
}: {
  targetCommentId: Id<"taskComments">
  startCommentId: Id<"taskComments">
  members: Member[]
  currentSubject?: string
  isAdmin: boolean
}) {
  const result = useQuery(api.taskComments.getAncestry, {
    commentId: targetCommentId,
    startCommentId,
    limit: 100,
  })
  if (!result)
    return (
      <p className="text-sm text-muted-foreground">Loading older ancestry…</p>
    )
  return (
    <>
      {result.nextCommentId ? (
        <OlderAncestry
          currentSubject={currentSubject}
          isAdmin={isAdmin}
          members={members}
          startCommentId={result.nextCommentId}
          targetCommentId={targetCommentId}
        />
      ) : null}
      {result.comments.map((comment, index) => (
        <CommentNode
          comment={comment}
          currentSubject={currentSubject}
          depth={index}
          isAdmin={isAdmin}
          key={comment._id}
          members={members}
          renderReplies={comment._id === targetCommentId}
          targetCommentId={targetCommentId}
        />
      ))}
    </>
  )
}

function mentionQueryAt(value: string, caret: number) {
  let index = caret - 1
  while (index >= 0) {
    const char = value[index]
    if (char === "@") {
      const preceding = value[index - 1]
      if (index === 0 || preceding === " " || preceding === "\n") {
        return { query: value.slice(index + 1, caret), start: index }
      }
      return null
    }
    if (char === " " || char === "\n") return null
    index -= 1
  }
  return null
}

function CommentComposer({
  members,
  onSubmit,
  placeholder = "Write a reply…",
  initialBody = "",
  initialMentions = [],
  onCancel,
  autoFocus = false,
}: {
  members: Member[]
  onSubmit: (payload: { body: string; mentions: Mention[] }) => Promise<void>
  placeholder?: string
  initialBody?: string
  initialMentions?: Mention[]
  onCancel?: () => void
  autoFocus?: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = useState(initialBody)
  const [tokens, setTokens] = useState(() =>
    initialMentions.map(({ subject, label }) => ({ subject, label }))
  )
  const [busy, setBusy] = useState(false)
  const [mention, setMention] = useState<{
    query: string
    start: number
  } | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const matches = mention
    ? members
        .filter((member) =>
          member.displayName.toLowerCase().includes(mention.query.toLowerCase())
        )
        .slice(0, 8)
    : []
  const open = matches.length > 0

  function syncMention(value: string, caret: number) {
    setMention(mentionQueryAt(value, caret))
    setActiveIndex(0)
  }

  function insertMention(member: Member) {
    const element = textareaRef.current
    const caret = element?.selectionStart ?? body.length
    const start = mention ? mention.start : caret
    const insert = `@${member.displayName} `
    setBody(body.slice(0, start) + insert + body.slice(caret))
    setTokens((value) => [
      ...value,
      { subject: member.userId, label: member.displayName },
    ])
    setMention(null)
    const cursor = start + insert.length
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(cursor, cursor)
    })
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
      setBody("")
      setTokens([])
      setMention(null)
    } catch (error) {
      toast.error(messageFromError(error, "Could not save the comment."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover
      onOpenChange={(next) => {
        if (!next) setMention(null)
      }}
      open={open}
    >
      <PopoverAnchor asChild>
        <div className="relative">
          <Textarea
            autoFocus={autoFocus}
            className="min-h-20 pb-10"
            maxLength={5000}
            onChange={(event) => {
              setBody(event.target.value)
              syncMention(
                event.target.value,
                event.target.selectionStart ?? event.target.value.length
              )
            }}
            onClick={(event) =>
              syncMention(
                event.currentTarget.value,
                event.currentTarget.selectionStart ?? 0
              )
            }
            onKeyDown={(event) => {
              if (open) {
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  setActiveIndex((index) => (index + 1) % matches.length)
                  return
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault()
                  setActiveIndex(
                    (index) => (index - 1 + matches.length) % matches.length
                  )
                  return
                }
                if (event.key === "Enter" || event.key === "Tab") {
                  const picked = matches[activeIndex]
                  if (picked) {
                    event.preventDefault()
                    insertMention(picked)
                    return
                  }
                }
                if (event.key === "Escape") {
                  event.preventDefault()
                  setMention(null)
                  return
                }
              }
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault()
                void submit()
              }
            }}
            placeholder={placeholder}
            ref={textareaRef}
            value={body}
          />
          <div className="absolute right-2 bottom-2 flex gap-1.5">
            {onCancel ? (
              <Button
                onClick={onCancel}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
            ) : null}
            <Button
              disabled={busy || !body.trim()}
              onClick={() => void submit()}
              size="sm"
              type="button"
            >
              <Send /> {busy ? "Saving…" : "Post"}
            </Button>
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="max-h-56 w-(--radix-popover-trigger-width) gap-0.5 overflow-y-auto p-1"
        onCloseAutoFocus={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => event.preventDefault()}
        sideOffset={4}
      >
        {matches.map((member, index) => (
          <Button
            className="w-full justify-start data-[active=true]:bg-muted"
            data-active={index === activeIndex ? "true" : undefined}
            key={member.userId}
            onMouseDown={(event) => {
              event.preventDefault()
              insertMention(member)
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            @{member.displayName}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
