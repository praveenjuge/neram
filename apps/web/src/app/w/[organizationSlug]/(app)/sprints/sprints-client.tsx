"use client"

import { useOrganization } from "@clerk/nextjs"
import { OrganizationProfile } from "@clerk/nextjs"
import { format } from "date-fns"
import { useMutation, usePaginatedQuery, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  ArrowRight,
  CalendarClock,
  Check,
  RotateCcw,
  Search,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import {
  positionFor,
  type Status,
} from "@/components/project-board/board-shared"
import { KanbanBoard } from "@/components/project-board/kanban-board"
import { TaskDialog } from "@/components/project-board/task-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { messageFromError } from "@/lib/errors"
import { groupBacklogTasks } from "@/lib/sprint-planning"
import { cn } from "@/lib/utils"

type SprintTab = "current" | "backlog" | "upcoming" | "history" | "settings"
type SprintTask = NonNullable<
  FunctionReturnType<typeof api.sprints.current>
>["tasks"][number]

const tabs: Array<{ id: SprintTab; label: string }> = [
  { id: "current", label: "Current" },
  { id: "backlog", label: "Backlog" },
  { id: "upcoming", label: "Upcoming" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
]

function dateRange(startsAt: number, endsAt: number) {
  return `${format(startsAt, "MMM d")} – ${format(endsAt, "MMM d, yyyy")}`
}

function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  )
}

function SprintHeader({
  number,
  startsAt,
  endsAt,
  state,
}: {
  number: number
  startsAt: number
  endsAt: number
  state: "Current" | "Upcoming"
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="font-heading text-base font-medium">
          {state} · Sprint {number}
        </h2>
        <p className="text-sm text-muted-foreground">
          {dateRange(startsAt, endsAt)}
        </p>
      </div>
      <Badge variant="outline">{state}</Badge>
    </div>
  )
}

function GoalEditor({
  initialGoal,
  sprint,
}: {
  initialGoal?: string
  sprint: "current" | "upcoming"
}) {
  const [goal, setGoal] = useState(initialGoal ?? "")
  const updateGoal = useMutation(api.sprints.updateGoal)
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${sprint}-goal`}>Sprint goal</Label>
      <div className="flex gap-2">
        <Input
          id={`${sprint}-goal`}
          maxLength={500}
          onChange={(event) => setGoal(event.target.value)}
          placeholder="What outcome should this Sprint achieve?"
          value={goal}
        />
        <Button
          onClick={() =>
            void updateGoal({ sprint, goal: goal || undefined })
              .then(() => toast.success("Sprint goal updated."))
              .catch((error) =>
                toast.error(
                  messageFromError(error, "Could not update the goal.")
                )
              )
          }
          variant="outline"
        >
          <Check /> Save
        </Button>
      </div>
    </div>
  )
}

function RemoveTaskButton({
  task,
  sprint,
}: {
  task: SprintTask
  sprint: "current" | "upcoming"
}) {
  const remove = useMutation(api.sprints.remove)
  return (
    <Button
      aria-label={`Remove ${task.title} from ${sprint}`}
      onClick={() =>
        void remove({ taskIds: [task._id], sprint })
          .then(() => toast.success("Task returned to Backlog."))
          .catch((error) =>
            toast.error(messageFromError(error, "Could not remove the task."))
          )
      }
      size="icon-sm"
      variant="ghost"
    >
      <X />
    </Button>
  )
}

function CurrentSprint() {
  const current = useQuery(api.sprints.current)
  const moveTask = useMutation(api.tasks.move)
  const [openTaskId, setOpenTaskId] = useState<Id<"tasks"> | null>(null)
  if (current === undefined) return <Loading />
  if (current === null)
    return (
      <p className="text-sm text-muted-foreground">
        Sprint setup is unavailable.
      </p>
    )
  const currentSprint = current

  async function handleDrop(
    taskId: Id<"tasks">,
    status: Status,
    insertIndex: number
  ) {
    const moving = currentSprint.tasks.find((task) => task._id === taskId)
    if (!moving) return
    const destination = currentSprint.tasks
      .filter(
        (task) => task.status === status && task.projectId === moving.projectId
      )
      .sort((a, b) => a.position - b.position)
    try {
      await moveTask({
        taskId,
        status,
        position: positionFor(destination, insertIndex, taskId),
      })
    } catch (error) {
      toast.error(messageFromError(error, "Could not move the task."))
    }
  }

  return (
    <div className="grid gap-5">
      <SprintHeader {...current.sprint} state="Current" />
      <GoalEditor initialGoal={current.sprint.goal} sprint="current" />
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-2 text-xs text-muted-foreground">
          Remove from Sprint:
        </span>
        {current.tasks
          .filter((task) => task.status !== "done")
          .map((task) => (
            <div
              className="flex items-center rounded-md border pl-2 text-xs"
              key={task._id}
            >
              <span className="max-w-48 truncate">{task.title}</span>
              <RemoveTaskButton sprint="current" task={task} />
            </div>
          ))}
      </div>
      <KanbanBoard
        onDrop={handleDrop}
        onOpenTask={setOpenTaskId}
        showProject
        tasks={current.tasks}
      />
      <TaskDialog
        commentId={null}
        onClose={() => setOpenTaskId(null)}
        onProjectChange={() => undefined}
        taskId={openTaskId}
      />
      <EarlyRollover />
    </div>
  )
}

function EarlyRollover() {
  const { organization } = useOrganization()
  const rollover = useMutation(api.sprints.rollover)
  const [reason, setReason] = useState("")
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-fit" variant="outline">
          <RotateCcw /> Roll over early
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Roll over this Sprint early?</DialogTitle>
          <DialogDescription>
            Unfinished work will carry into Upcoming. This is audited and cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="rollover-reason">Reason</Label>
          <Textarea
            id="rollover-reason"
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!organization?.slug || !reason.trim()}
            onClick={() =>
              organization?.slug &&
              void rollover({
                organizationId: organization.id,
                slug: organization.slug,
                confirm: true,
                reason: reason.trim(),
              })
                .then(() => toast.success("Sprint rollover started."))
                .catch((error) =>
                  toast.error(
                    messageFromError(error, "Could not roll over the Sprint.")
                  )
                )
            }
            variant="destructive"
          >
            Confirm rollover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TaskPicker() {
  const backlog = useQuery(api.sprints.backlog)
  const plan = useMutation(api.sprints.plan)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<Id<"tasks">>>(() => new Set())
  const grouped = useMemo(
    () => groupBacklogTasks(backlog ?? [], query),
    [backlog, query]
  )
  if (backlog === undefined) return <Loading />

  function submit(sprint: "current" | "upcoming") {
    const taskIds = [...selected]
    if (taskIds.length === 0) return
    void plan({ taskIds, sprint })
      .then(() => {
        setSelected(new Set())
        toast.success(
          `Planned ${taskIds.length} task${taskIds.length === 1 ? "" : "s"}.`
        )
      })
      .catch((error) =>
        toast.error(messageFromError(error, "Could not plan those tasks."))
      )
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
        <Button
          disabled={selected.size === 0}
          onClick={() => submit("current")}
          variant="outline"
        >
          Plan to Current
        </Button>
        <Button
          disabled={selected.size === 0}
          onClick={() => submit("upcoming")}
        >
          Plan to Upcoming <ArrowRight />
        </Button>
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
                <input
                  checked={selected.has(task._id)}
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = new Set(current)
                      if (event.target.checked) next.add(task._id)
                      else next.delete(task._id)
                      return next
                    })
                  }
                  type="checkbox"
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

function UpcomingSprint() {
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
      <SprintHeader {...upcoming.sprint} state="Upcoming" />
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

function SprintHistory() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.sprints.history,
    {},
    { initialNumItems: 10 }
  )
  const [selectedSprintId, setSelectedSprintId] =
    useState<Id<"sprints"> | null>(null)
  const audit = useQuery(
    api.sprints.audit,
    selectedSprintId
      ? {
          sprintId: selectedSprintId,
          paginationOpts: { numItems: 100, cursor: null },
        }
      : "skip"
  )
  return (
    <div className="grid gap-4">
      {results.map((sprint) => (
        <button
          className={cn(
            "grid gap-2 rounded-lg border p-3 text-left hover:bg-muted/50",
            selectedSprintId === sprint._id && "border-primary"
          )}
          key={sprint._id}
          onClick={() => setSelectedSprintId(sprint._id)}
          type="button"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="font-medium">Sprint {sprint.number}</span>
            <span className="text-xs text-muted-foreground">
              {dateRange(sprint.startsAt, sprint.endsAt)}
            </span>
          </span>
          <span className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{sprint.baselineCount ?? 0} baseline</span>
            <span>{sprint.completedCount ?? 0} completed</span>
            <span>{sprint.carriedCount ?? 0} carried</span>
            <span>{sprint.addedCount ?? 0} added</span>
            <span>{sprint.removedCount ?? 0} removed</span>
          </span>
        </button>
      ))}
      {status === "CanLoadMore" ? (
        <Button
          className="w-fit"
          onClick={() => loadMore(10)}
          variant="outline"
        >
          Load more
        </Button>
      ) : null}
      {selectedSprintId ? (
        <section className="grid gap-2 border-t pt-4">
          <h2 className="font-medium">Scope audit</h2>
          {audit === undefined ? (
            <Spinner />
          ) : (
            audit.page.map((entry) => (
              <div
                className="flex flex-wrap items-center gap-2 text-sm"
                key={entry._id}
              >
                <Badge variant="outline">
                  {entry.origin.replace("_", " ")}
                </Badge>
                <span>{entry.taskTitleSnapshot}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.projectNameSnapshot}
                </span>
                {entry.removedAt ? (
                  <Badge variant="secondary">removed</Badge>
                ) : null}
              </div>
            ))
          )}
        </section>
      ) : null}
    </div>
  )
}

type CadenceSettingsValue = NonNullable<
  FunctionReturnType<typeof api.organizations.current>["settings"]
>

function CadenceSettings({
  settings,
}: {
  settings: CadenceSettingsValue | null
}) {
  const updateCadence = useMutation(api.sprints.updateCadence)
  const [cadenceWeeks, setCadenceWeeks] = useState(
    String(settings?.cadenceWeeks ?? 2)
  )
  const [startWeekday, setStartWeekday] = useState(
    String(settings?.startWeekday ?? 1)
  )
  const [timezone, setTimezone] = useState(
    settings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  return (
    <section className="grid max-w-xl gap-4">
      <div>
        <h2 className="font-medium">Cadence</h2>
        <p className="text-sm text-muted-foreground">
          Changes apply to Upcoming, never the active Sprint dates.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="cadence-weeks">Weeks</Label>
          <Input
            id="cadence-weeks"
            max={8}
            min={1}
            onChange={(event) => setCadenceWeeks(event.target.value)}
            type="number"
            value={cadenceWeeks}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="start-weekday">Start day</Label>
          <Select onValueChange={setStartWeekday} value={startWeekday}>
            <SelectTrigger id="start-weekday">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ].map((day, index) => (
                <SelectItem key={day} value={String(index)}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sprint-timezone">IANA timezone</Label>
          <Input
            id="sprint-timezone"
            onChange={(event) => setTimezone(event.target.value)}
            value={timezone}
          />
        </div>
      </div>
      <Button
        className="w-fit"
        onClick={() =>
          void updateCadence({
            cadenceWeeks: Number(cadenceWeeks),
            startWeekday: Number(startWeekday),
            timezone,
          })
            .then(() => toast.success("Sprint cadence updated."))
            .catch((error) =>
              toast.error(messageFromError(error, "Could not update cadence."))
            )
        }
      >
        <CalendarClock /> Update cadence
      </Button>
    </section>
  )
}

function SprintSettings() {
  const context = useQuery(api.organizations.current)
  if (context === undefined) return <Loading />
  return (
    <div className="grid gap-8">
      <CadenceSettings
        key={`${context.organization.organizationId}:${context.settings?.updatedAt ?? "default"}`}
        settings={context.settings}
      />
      <section className="grid gap-3 border-t pt-6">
        <div>
          <h2 className="font-medium">Workspace members</h2>
          <p className="text-sm text-muted-foreground">
            Invite people and manage roles through Clerk.
          </p>
        </div>
        <OrganizationProfile routing="hash" />
      </section>
    </div>
  )
}

export function SprintsClient() {
  const [tab, setTab] = useState<SprintTab>("current")
  return (
    <section className="mx-auto grid w-full max-w-7xl gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-lg font-medium">Sprints</h1>
        <nav aria-label="Sprint views" className="flex flex-wrap gap-1">
          {tabs.map((item) => (
            <Button
              key={item.id}
              onClick={() => setTab(item.id)}
              size="sm"
              variant={tab === item.id ? "default" : "ghost"}
            >
              {item.label}
            </Button>
          ))}
        </nav>
      </div>
      {tab === "current" ? <CurrentSprint /> : null}
      {tab === "backlog" ? <TaskPicker /> : null}
      {tab === "upcoming" ? <UpcomingSprint /> : null}
      {tab === "history" ? <SprintHistory /> : null}
      {tab === "settings" ? <SprintSettings /> : null}
    </section>
  )
}
