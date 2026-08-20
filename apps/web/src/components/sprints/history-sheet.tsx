"use client"

import { usePaginatedQuery, useQuery } from "convex/react"

import { api } from "@neram/convex/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"

import { dateRange } from "./shared"

export function HistorySheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Sprint history</SheetTitle>
          <SheetDescription>
            What the team committed to and completed.
          </SheetDescription>
        </SheetHeader>
        <HistoryContent />
      </SheetContent>
    </Sheet>
  )
}

function HistoryContent() {
  const current = useQuery(api.sprints.current)
  const { results, status, loadMore } = usePaginatedQuery(
    api.sprints.history,
    {},
    { initialNumItems: 10 }
  )
  const completed =
    current?.tasks.filter((task) => task.status === "done") ?? []

  if (status === "LoadingFirstPage" || current === undefined) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  if (results.length === 0 && completed.length === 0) {
    return (
      <p className="px-6 pb-6 text-sm text-muted-foreground">
        No completed work or closed Sprints yet.
      </p>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6">
      <div className="grid gap-4">
        {completed.length > 0 ? (
          <section className="grid gap-2 border-b pb-4">
            <h3 className="text-sm font-medium">Completed this Sprint</h3>
            <div className="grid divide-y">
              {completed.map((task) => (
                <div className="flex items-center gap-2 py-2" key={task._id}>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {task.title}
                  </span>
                  <Badge variant="outline">{task.projectName}</Badge>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {results.map((sprint) => {
          const committed = sprint.baselineCount ?? 0
          const finished = sprint.completedCount ?? 0
          return (
            <article className="grid gap-2 border-b pb-4" key={sprint._id}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {dateRange(sprint.startsAt, sprint.endsAt)}
                </span>
                <Badge variant="secondary">
                  {finished} of {committed}
                </Badge>
              </div>
              {sprint.goal ? (
                <p className="text-sm text-muted-foreground">{sprint.goal}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {finished === committed && committed > 0
                  ? "All committed work completed"
                  : `${Math.max(0, committed - finished)} unfinished`}
              </p>
            </article>
          )
        })}
        {status === "CanLoadMore" ? (
          <Button
            className="w-fit"
            onClick={() => loadMore(10)}
            variant="outline"
          >
            Load more
          </Button>
        ) : null}
      </div>
    </div>
  )
}
