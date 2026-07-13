"use client"

import { useQuery } from "convex/react"

import { api } from "@neram/convex/api"
import { Badge } from "@/components/ui/badge"

import { GoalEditor } from "./goal-editor"
import { Loading, RemoveTaskButton, SprintHeader } from "./shared"

const UPCOMING_HINT =
  "The next Sprint. Whatever is planned here becomes the baseline when it starts."

export function UpcomingSprint() {
  const upcoming = useQuery(api.sprints.upcoming)
  if (upcoming === undefined) return <Loading />
  if (upcoming === null)
    return (
      <p className="text-sm text-muted-foreground">
        Upcoming Sprint is unavailable.
      </p>
    )
  return (
    <div className="grid gap-5">
      <SprintHeader {...upcoming.sprint} hint={UPCOMING_HINT} state="Upcoming" />
      <GoalEditor initialGoal={upcoming.sprint.goal} sprint="upcoming" />
      <div className="grid divide-y rounded-lg border">
        {upcoming.tasks.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Plan Backlog tasks to build the next baseline.
          </p>
        ) : (
          upcoming.tasks.map((task) => (
            <div className="flex items-center gap-3 px-3 py-2" key={task._id}>
              <span className="min-w-0 flex-1 truncate text-sm">
                {task.title}
              </span>
              <Badge variant="outline">{task.projectName}</Badge>
              <RemoveTaskButton sprint="upcoming" task={task} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
