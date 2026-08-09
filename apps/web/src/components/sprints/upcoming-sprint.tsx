"use client"

import { useMutation, useQuery } from "convex/react"
import { CalendarPlus, ChevronDown, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
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
  const [expanded, setExpanded] = useState<Set<Id<"sprints">>>(() => new Set())
  if (upcoming === undefined) return <Loading />

  // Match the number the backend will assign (settings.nextSprintNumber) so the
  // default name never duplicates an existing Sprint — e.g. an active
  // "Sprint 1" with nothing scheduled suggests "Sprint 2", not "Sprint 1".
  const nextNumber = context?.settings?.nextSprintNumber ?? 1

  function toggle(sprintId: Id<"sprints">) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(sprintId)) next.delete(sprintId)
      else next.add(sprintId)
      return next
    })
  }

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
        <div className="divide-y rounded-lg border">
          {upcoming.map(({ sprint, tasks }) => {
            const isExpanded = expanded.has(sprint._id)
            return (
              <section key={sprint._id}>
                <div className="flex items-center gap-1 p-2">
                  <button
                    aria-expanded={isExpanded}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
                    onClick={() => toggle(sprint._id)}
                    type="button"
                  >
                    <ChevronDown
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="truncate font-heading text-sm font-medium">
                        {sprintLabel(sprint)}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="shrink-0">
                          {dateRange(sprint.startsAt, sprint.endsAt)}
                        </span>
                        <span aria-hidden>·</span>
                        <span className="truncate">
                          {sprint.goal || "No goal set"}
                        </span>
                      </span>
                    </span>
                    <Badge className="shrink-0" variant="secondary">
                      {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                    </Badge>
                  </button>
                  <div className="flex shrink-0 items-center">
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
                {isExpanded ? (
                  <div className="grid gap-3 border-t px-4 py-3">
                    <GoalEditor initialGoal={sprint.goal} sprint={sprint._id} />
                    {tasks.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        No tasks planned. Use Plan Sprint to add work.
                      </p>
                    ) : (
                      <div className="grid divide-y border-y">
                        {tasks.map((task) => (
                          <div
                            className="flex items-center gap-3 py-2"
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
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
