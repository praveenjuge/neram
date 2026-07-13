"use client"

import { useMutation } from "convex/react"
import { Check, Pencil, X } from "lucide-react"
import { useState } from "react"

import { api } from "@neram/convex/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { InfoHint, runToast, type SprintTarget } from "./shared"

const GOAL_HINT =
  "A short outcome this Sprint should achieve. Keep it to one sentence."

export function GoalEditor({
  initialGoal,
  sprint,
}: {
  initialGoal?: string
  sprint: SprintTarget
}) {
  const updateGoal = useMutation(api.sprints.updateGoal)
  const [editing, setEditing] = useState(false)
  const [goal, setGoal] = useState(initialGoal ?? "")

  function save() {
    runToast(updateGoal({ sprint, goal: goal.trim() || undefined }), {
      success: "Sprint goal updated.",
      error: "Could not update the goal.",
    })
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Goal</span>
        <InfoHint text={GOAL_HINT} />
        <span
          className={
            initialGoal
              ? "min-w-0 flex-1 truncate"
              : "min-w-0 flex-1 truncate text-muted-foreground"
          }
        >
          {initialGoal || "Not set yet"}
        </span>
        <Button
          aria-label="Edit Sprint goal"
          onClick={() => {
            setGoal(initialGoal ?? "")
            setEditing(true)
          }}
          size="icon-sm"
          variant="ghost"
        >
          <Pencil />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        maxLength={500}
        onChange={(event) => setGoal(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") save()
          if (event.key === "Escape") setEditing(false)
        }}
        placeholder="What outcome should this Sprint achieve?"
        value={goal}
      />
      <Button
        aria-label="Save goal"
        onClick={save}
        size="icon"
        variant="outline"
      >
        <Check />
      </Button>
      <Button
        aria-label="Cancel"
        onClick={() => setEditing(false)}
        size="icon"
        variant="ghost"
      >
        <X />
      </Button>
    </div>
  )
}
