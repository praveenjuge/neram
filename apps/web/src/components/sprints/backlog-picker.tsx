"use client"

import { useMutation, useQuery } from "convex/react"
import { Search } from "lucide-react"
import { useMemo, useState } from "react"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { groupBacklogTasks } from "@/lib/sprint-planning"

import { PlanTargetDialog } from "./plan-dialog"
import { InfoHint, Loading, runToast, type SprintTarget } from "./shared"

const BACKLOG_HINT =
  "Tasks not yet in a Sprint. Select any, then plan them into Current or a scheduled Sprint."

export function BacklogPicker() {
  const backlog = useQuery(api.sprints.backlog)
  const plan = useMutation(api.sprints.plan)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<Id<"tasks">>>(() => new Set())
  const grouped = useMemo(
    () => groupBacklogTasks(backlog ?? [], query),
    [backlog, query]
  )
  if (backlog === undefined) return <Loading />

  function submit(target: SprintTarget) {
    const taskIds = [...selected]
    if (taskIds.length === 0) return
    runToast(plan({ taskIds, sprint: target }), {
      success: `Planned ${taskIds.length} task${taskIds.length === 1 ? "" : "s"}.`,
      error: "Could not plan those tasks.",
    })
    setSelected(new Set())
  }

  function toggle(taskId: Id<"tasks">, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(taskId)
      else next.delete(taskId)
      return next
    })
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search backlog"
            value={query}
          />
        </div>
        <InfoHint text={BACKLOG_HINT} />
        <PlanTargetDialog
          count={selected.size}
          onConfirm={submit}
          trigger={
            <Button disabled={selected.size === 0}>
              {selected.size === 0
                ? "Plan tasks"
                : `Plan ${selected.size} ${selected.size === 1 ? "task" : "tasks"}`}
            </Button>
          }
        />
      </div>
      {grouped.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No matching Backlog tasks.
        </p>
      ) : (
        grouped.map(([project, tasks]) => (
          <section className="grid gap-1" key={project}>
            <h2 className="px-2 text-xs font-medium text-muted-foreground">
              {project}
            </h2>
            {tasks.map((task) => (
              <label
                className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 hover:bg-muted/50"
                key={task._id}
              >
                <Checkbox
                  checked={selected.has(task._id)}
                  onCheckedChange={(checked) =>
                    toggle(task._id, checked === true)
                  }
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {task.title}
                </span>
                <Badge variant="secondary">{task.status}</Badge>
              </label>
            ))}
          </section>
        ))
      )}
    </div>
  )
}
