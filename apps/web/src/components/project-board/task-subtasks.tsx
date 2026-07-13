"use client"

import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { messageFromError } from "@/lib/errors"
import { cn } from "@/lib/utils"

export function TaskSubtasks({ taskId }: { taskId: Id<"tasks"> }) {
  const [title, setTitle] = useState("")
  const rows = useQuery(api.subtasks.list, { taskId })
  const create = useMutation(api.subtasks.create)

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

  return (
    <section className="grid gap-2" data-testid="task-subtasks">
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
        <ul className="grid">
          {rows.map((row) => (
            <SubtaskRow key={row._id} row={row} />
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
}: {
  row: {
    _id: Id<"subtasks">
    title: string
    completed: boolean
  }
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
    <li className="group/subtask flex items-center gap-2 rounded-lg px-1 transition-colors hover:bg-muted/50">
      <Checkbox
        aria-label={row.completed ? "Reopen subtask" : "Complete subtask"}
        checked={row.completed}
        onCheckedChange={(value) =>
          void setCompleted({ subtaskId: row._id, completed: value === true })
        }
      />
      <Input
        aria-label="Subtask title"
        className={cn(
          "h-7 border-0 bg-transparent px-1.5 shadow-none focus-visible:bg-input/50 focus-visible:ring-0",
          row.completed && "text-muted-foreground line-through"
        )}
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
      <Button
        aria-label="Delete subtask"
        className="opacity-0 transition-opacity group-focus-within/subtask:opacity-100 group-hover/subtask:opacity-100 max-md:opacity-100"
        onClick={() => void remove({ subtaskId: row._id })}
        size="icon-sm"
        variant="ghost"
      >
        <Trash2 />
      </Button>
    </li>
  )
}
