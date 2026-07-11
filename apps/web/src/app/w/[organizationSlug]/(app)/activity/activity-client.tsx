"use client"

import { usePaginatedQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  ArrowRight,
  AtSign,
  CalendarClock,
  History,
  LogOut,
  Pencil,
  Plus,
  Play,
  Reply,
  RotateCcw,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

import { api } from "@neram/convex/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { workspaceHref } from "@/lib/workspace"

type ActivityItem = FunctionReturnType<typeof api.activity.list>["page"][number]

const statusLabel: Record<string, string> = {
  todo: "Todo",
  inProgress: "In Progress",
  done: "Done",
}

const typeIcon: Record<ActivityItem["type"], LucideIcon> = {
  "task.created": Plus,
  "task.moved": ArrowRight,
  "task.assigned": UserCheck,
  "task.deleted": Trash2,
  "project.updated": Pencil,
  "member.joined": UserPlus,
  "member.left": LogOut,
  "member.removed": UserMinus,
  "comment.mentioned": AtSign,
  "comment.replied": Reply,
  "sprint.started": Play,
  "sprint.rolled_over": RotateCcw,
  "sprint.early_closed": RotateCcw,
  "sprint.cadence_changed": CalendarClock,
}

/** A short past-tense phrase describing what the actor did. */
function describe(item: ActivityItem): string {
  switch (item.type) {
    case "task.created":
      return `added ${item.taskTitle ?? "a task"}`
    case "task.moved":
      return `moved ${item.taskTitle ?? "a task"} to ${
        statusLabel[item.toStatus ?? ""] ?? "another column"
      }`
    case "task.assigned": {
      const who = item.assigneeName ?? "someone"
      return `assigned ${item.taskTitle ?? "a task"} to ${who}`
    }
    case "task.deleted":
      return `deleted ${item.taskTitle ?? "a task"}`
    case "project.updated":
      return "updated the project"
    case "member.joined":
      return "joined"
    case "member.left":
      return "left"
    case "member.removed":
      return "was removed"
    case "comment.mentioned":
      return `mentioned you on ${item.taskTitle ?? "a task"}`
    case "comment.replied":
      return `replied to you on ${item.taskTitle ?? "a task"}`
    case "sprint.started":
      return `started Sprint ${item.sprintNumber ?? ""}`.trim()
    case "sprint.rolled_over":
      return `rolled over Sprint ${item.sprintNumber ?? ""}`.trim()
    case "sprint.early_closed":
      return `closed Sprint ${item.sprintNumber ?? ""} early`.trim()
    case "sprint.cadence_changed":
      return "updated the Sprint cadence"
    default:
      return "made a change"
  }
}

const relativeUnits: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1_000],
]

function relativeTime(timestamp: number): string {
  const diff = timestamp - Date.now()
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  for (const [unit, ms] of relativeUnits) {
    if (abs >= ms || unit === "second") {
      return rtf.format(Math.round(diff / ms), unit)
    }
  }
  return "just now"
}

function activityContext(item: ActivityItem) {
  if (item.projectName) return item.projectName
  if ("sprintNumber" in item && item.sprintNumber) {
    return `Sprint ${item.sprintNumber}`
  }
  return "Workspace"
}

export function ActivityClient() {
  const params = useParams()
  const organizationSlug =
    typeof params.organizationSlug === "string" ? params.organizationSlug : ""
  const { results, status, loadMore } = usePaginatedQuery(
    api.activity.list,
    {},
    { initialNumItems: 30 }
  )

  return (
    <section className="mx-auto grid w-full max-w-3xl gap-6 p-5">
      <h1 className="font-heading text-lg font-medium">Activity</h1>
      {status === "LoadingFirstPage" ? (
        <div className="grid min-h-[40vh] place-items-center">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : results.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-2">
          <ul className="grid gap-2">
            {results.map((item) => {
              const Icon = typeIcon[item.type] ?? History
              const taskId = "taskId" in item ? item.taskId : undefined
              const commentId = "commentId" in item ? item.commentId : undefined
              const commentExcerpt =
                "commentExcerpt" in item ? item.commentExcerpt : undefined
              const card = (
                <Card
                  className={
                    taskId ? "transition-colors hover:bg-muted/40" : undefined
                  }
                  size="sm"
                >
                  <CardContent className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm">
                        <span className="font-medium">{item.actorName}</span>{" "}
                        {describe(item)}
                      </p>
                      {commentExcerpt ? (
                        <p className="line-clamp-1 text-sm text-muted-foreground">
                          “{commentExcerpt}”
                        </p>
                      ) : null}
                      <p className="truncate text-sm text-muted-foreground">
                        {activityContext(item)} · {relativeTime(item.createdAt)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
              return (
                <li key={item._id}>
                  {taskId && item.projectId ? (
                    <Link
                      href={`${workspaceHref(organizationSlug, `/projects/${item.projectId}`)}?task=${taskId}${commentId ? `&comment=${commentId}` : ""}`}
                    >
                      {card}
                    </Link>
                  ) : (
                    card
                  )}
                </li>
              )
            })}
          </ul>
          {status === "CanLoadMore" || status === "LoadingMore" ? (
            <div className="grid place-items-center pt-2">
              <Button
                data-testid="load-more-activity"
                disabled={status === "LoadingMore"}
                onClick={() => loadMore(30)}
                size="sm"
                variant="outline"
              >
                {status === "LoadingMore" ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

function EmptyState() {
  return (
    <Card className="items-center justify-center gap-3 border border-dashed py-12 text-center shadow-none ring-0">
      <CardContent className="flex flex-col items-center gap-3">
        <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <History className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">No activity yet</p>
          <p className="text-sm text-muted-foreground">
            Actions across this workspace will show up here.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
