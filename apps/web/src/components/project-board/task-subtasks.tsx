"use client"

import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { messageFromError } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function TaskSubtasks({ taskId }: { taskId: Id<"tasks"> }) {
  const [hideCompleted, setHideCompleted] = useState(false)
  const [title, setTitle] = useState("")
  const rows = useQuery(api.subtasks.list, { taskId, hideCompleted })
  const create = useMutation(api.subtasks.create)
  const reorder = useMutation(api.subtasks.reorder)

  async function add() {
    const next = title.trim()
    if (!next) return
    try {
      await create({ taskId, title: next })
      setTitle("")
    } catch (error) {
      toast.error(messageFromError(error, "Could not add the subtask."))
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (!rows) return
    const target = rows[index + direction]
    const current = rows[index]
    if (!target || !current) return
    try {
      await reorder({
        subtaskId: current._id,
        ...(direction < 0
          ? { beforeSubtaskId: target._id }
          : { afterSubtaskId: target._id }),
      })
    } catch (error) {
      toast.error(messageFromError(error, "Could not move the subtask."))
    }
  }

  return (
    <section className="grid gap-3" data-testid="task-subtasks">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-medium">Subtasks</h2>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            checked={hideCompleted}
            onChange={(event) => setHideCompleted(event.target.checked)}
            type="checkbox"
          />
          Hide completed
        </label>
      </div>
      <div className="flex gap-2">
        <Input
          aria-label="New subtask title"
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              void add()
            }
          }}
          placeholder="Add a subtask"
          value={title}
        />
        <Button disabled={!title.trim()} onClick={() => void add()} size="sm">
          <Plus /> Add
        </Button>
      </div>
      {rows?.length ? (
        <ul className="grid gap-1.5">
          {rows.map((row, index) => (
            <SubtaskRow
              canMoveDown={index < rows.length - 1}
              canMoveUp={index > 0}
              key={row._id}
              onMoveDown={() => void move(index, 1)}
              onMoveUp={() => void move(index, -1)}
              row={row}
            />
          ))}
        </ul>
      ) : (
        <p className="px-1 text-sm text-muted-foreground">
          {rows ? "No subtasks yet." : "Loading subtasks…"}
        </p>
      )}
    </section>
  )
}

function SubtaskRow({
  row,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  row: {
    _id: Id<"subtasks">
    title: string
    completed: boolean
  }
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [title, setTitle] = useState(row.title)
  const setCompleted = useMutation(api.subtasks.setCompleted)
  const rename = useMutation(api.subtasks.rename)
  const remove = useMutation(api.subtasks.remove)

  async function save() {
    const next = title.trim()
    if (!next || next === row.title) {
      setTitle(row.title)
      return
    }
    try {
      await rename({ subtaskId: row._id, title: next })
    } catch (error) {
      setTitle(row.title)
      toast.error(messageFromError(error, "Could not rename the subtask."))
    }
  }

  return (
    <li className="group/subtask flex items-center gap-1 rounded-lg p-1 transition-colors hover:bg-muted/50">
      <Button
        aria-label={row.completed ? "Reopen subtask" : "Complete subtask"}
        onClick={() =>
          void setCompleted({
            subtaskId: row._id,
            completed: !row.completed,
          })
        }
        size="icon-sm"
        variant={row.completed ? "secondary" : "ghost"}
      >
        <Check className={row.completed ? undefined : "opacity-30"} />
      </Button>
      <Input
        aria-label="Subtask title"
        className={row.completed ? "line-through opacity-60" : undefined}
        maxLength={200}
        onBlur={() => void save()}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
          if (event.key === "Escape") {
            setTitle(row.title)
            event.currentTarget.blur()
          }
        }}
        value={title}
      />
      <div className="flex items-center opacity-0 transition-opacity group-focus-within/subtask:opacity-100 group-hover/subtask:opacity-100 max-md:opacity-100">
        <Button
          aria-label="Move subtask up"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          size="icon-sm"
          variant="ghost"
        >
          <ArrowUp />
        </Button>
        <Button
          aria-label="Move subtask down"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          size="icon-sm"
          variant="ghost"
        >
          <ArrowDown />
        </Button>
        <Button
          aria-label="Delete subtask"
          onClick={() => void remove({ subtaskId: row._id })}
          size="icon-sm"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}
