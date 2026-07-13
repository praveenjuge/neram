"use client"

import { usePaginatedQuery, useQuery } from "convex/react"
import { History } from "lucide-react"
import { useState } from "react"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

import { dateRange, InfoHint } from "./shared"

const COUNTS_HINT =
  "baseline: tasks at start · completed: finished · carried: moved to the next Sprint · added: added mid-Sprint · removed: returned to Backlog."

export function HistorySheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost">
          <History /> History
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-1.5">
            Sprint history
            <InfoHint text={COUNTS_HINT} />
          </SheetTitle>
          <SheetDescription>
            Closed Sprints and their append-only scope audit.
          </SheetDescription>
        </SheetHeader>
        <HistoryContent />
      </SheetContent>
    </Sheet>
  )
}

function HistoryContent() {
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

  if (status === "LoadingFirstPage") {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <p className="px-6 pb-6 text-sm text-muted-foreground">
        No closed Sprints yet.
      </p>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6">
      <div className="grid gap-3">
        {results.map((sprint) => {
          const isSelected = selectedSprintId === sprint._id
          return (
            <div
              className={cn(
                "grid gap-2 rounded-lg border p-3 transition-colors",
                isSelected && "border-primary"
              )}
              key={sprint._id}
            >
              <button
                className="grid gap-2 text-left"
                onClick={() =>
                  setSelectedSprintId(isSelected ? null : sprint._id)
                }
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
              {isSelected ? (
                <div className="grid gap-1.5 border-t pt-2">
                  {audit === undefined ? (
                    <Spinner className="size-4" />
                  ) : audit.page.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No scope changes recorded.
                    </span>
                  ) : (
                    audit.page.map((entry) => (
                      <div
                        className="flex flex-wrap items-center gap-2 text-xs"
                        key={entry._id}
                      >
                        <Badge variant="outline">
                          {entry.origin.replace("_", " ")}
                        </Badge>
                        <span className="text-foreground">
                          {entry.taskTitleSnapshot}
                        </span>
                        <span className="text-muted-foreground">
                          {entry.projectNameSnapshot}
                        </span>
                        {entry.removedAt ? (
                          <Badge variant="secondary">removed</Badge>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
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
