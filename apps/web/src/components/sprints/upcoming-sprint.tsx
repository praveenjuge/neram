"use client"

import { useMutation, useQuery } from "convex/react"
import { CalendarPlus, Pencil, Trash2 } from "lucide-react"

import { api } from "@neram/convex/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { GoalEditor } from "./goal-editor"
import {
  dateRange,
  InfoHint,
  Loading,
  RemoveTaskButton,
  runToast,
  sprintLabel,
} from "./shared"
import { SprintNameDialog } from "./sprint-name-dialog"

const UPCOMING_HINT =
  "Scheduled future Sprints. Plan Backlog work into any of them; the soonest becomes the baseline when the active Sprint ends."

export function UpcomingSprint() {
  const upcoming = useQuery(api.sprints.upcomingList)
  const context = useQuery(api.organizations.current)
  const schedule = useMutation(api.sprints.scheduleSprint)
  const unschedule = useMutation(api.sprints.unscheduleSprint)
  const rename = useMutation(api.sprints.renameSprint)
  if (upcoming === undefined) return <Loading />

  // Match the number the backend will assign (settings.nextSprintNumber) so the
  // default name never duplicates an existing Sprint — e.g. an active
  // "Sprint 1" with nothing scheduled suggests "Sprint 2", not "Sprint 1".
  const nextNumber = context?.settings?.nextSprintNumber ?? 1

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-heading text-base font-medium">
          Upcoming
          <InfoHint text={UPCOMING_HINT} />
        </h2>
        <SprintNameDialog
          defaultName={`Sprint ${nextNumber}`}
          description="Name your Sprint. It's scheduled right after the last one using your cadence."
          onSubmit={(name) =>
            runToast(schedule({ name }), {
              success: "Scheduled a new Sprint.",
              error: "Could not schedule a Sprint.",
            })
          }
          submitLabel="Create Sprint"
          title="New Sprint"
          trigger={
            <Button size="sm" variant="outline">
              <CalendarPlus /> New Sprint
            </Button>
          }
        />
      </div>
      {upcoming.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No upcoming Sprints scheduled.
        </p>
      ) : (
        upcoming.map(({ sprint, tasks }) => (
          <section
            className="grid gap-3 rounded-lg border p-4"
            key={sprint._id}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <div>
                  <h3 className="font-heading text-sm font-medium">
                    {sprintLabel(sprint)}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {dateRange(sprint.startsAt, sprint.endsAt)}
                  </p>
                </div>
                <SprintNameDialog
                  defaultName={sprintLabel(sprint)}
                  description="Update this Sprint's name."
                  onSubmit={(name) =>
                    runToast(rename({ sprint: sprint._id, name }), {
                      success: "Renamed the Sprint.",
                      error: "Could not rename the Sprint.",
                    })
                  }
                  submitLabel="Save"
                  title="Rename Sprint"
                  trigger={
                    <Button
                      aria-label={`Rename ${sprintLabel(sprint)}`}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Pencil />
                    </Button>
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                </Badge>
                <Button
                  aria-label={`Remove ${sprintLabel(sprint)}`}
                  onClick={() =>
                    runToast(unschedule({ sprintId: sprint._id }), {
                      success: "Removed the scheduled Sprint.",
                      error: "Could not remove the Sprint.",
                    })
                  }
                  size="icon-sm"
                  variant="ghost"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <GoalEditor initialGoal={sprint.goal} sprint={sprint._id} />
            {tasks.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                No tasks planned. Add work from the Backlog.
              </p>
            ) : (
              <div className="grid divide-y rounded-md border">
                {tasks.map((task) => (
                  <div
                    className="flex items-center gap-3 px-3 py-2"
                    key={task._id}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {task.title}
                    </span>
                    <Badge variant="outline">{task.projectName}</Badge>
                    <RemoveTaskButton sprint={sprint._id} task={task} />
                  </div>
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  )
}
