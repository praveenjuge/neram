"use client"

import { useMutation, usePaginatedQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ArchiveRestore, Inbox, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { DeleteProjectDialog } from "@/components/project-dialogs"
import { messageFromError } from "@/lib/errors"
import { unarchiveProjectOptimistic } from "@/lib/optimistic"
import { getProjectColorText } from "@/lib/project-colors"
import { ProjectIcon } from "@/lib/project-icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DialogTrigger } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type ArchivedProject = FunctionReturnType<
  typeof api.projects.listArchived
>["page"][number]

const PAGE_SIZE = 30

export function ArchivedClient() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.projects.listArchived,
    {},
    { initialNumItems: PAGE_SIZE }
  )

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 p-5">
      <div className="grid gap-1">
        <h1 className="font-heading text-lg font-medium">Archived projects</h1>
        <p className="text-sm text-muted-foreground">
          Unarchive a project to bring it back, or permanently delete it here.
        </p>
      </div>
      {status === "LoadingFirstPage" ? (
        <div className="grid min-h-[40vh] place-items-center">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : results.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-0 divide-y divide-border rounded-lg border">
            {results.map((project) => (
              <ArchivedRow key={project._id} project={project} />
            ))}
          </div>
          {status === "CanLoadMore" || status === "LoadingMore" ? (
            <div className="grid place-items-center pt-1">
              <Button
                data-testid="load-more-archived"
                disabled={status === "LoadingMore"}
                onClick={() => loadMore(PAGE_SIZE)}
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

function UnarchiveButton({ id, name }: { id: Id<"projects">; name: string }) {
  const unarchive = useMutation(api.projects.unarchive).withOptimisticUpdate(
    unarchiveProjectOptimistic
  )

  function onUnarchive() {
    void unarchive({ projectId: id })
      .then(() => toast.success(`Unarchived ${name}.`))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not unarchive the project."))
      )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label="Unarchive project"
          data-testid="unarchive-project-trigger"
          onClick={onUnarchive}
          size="icon-sm"
          variant="ghost"
        >
          <ArchiveRestore />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Unarchive</TooltipContent>
    </Tooltip>
  )
}

function ArchivedRow({ project }: { project: ArchivedProject }) {
  const counts = [
    { label: "Todo", value: project.todoCount },
    { label: "Doing", value: project.inProgressCount },
    { label: "Done", value: project.doneCount },
  ]

  return (
    <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ProjectIcon
          className={cn("size-4 shrink-0", getProjectColorText(project.color))}
          name={project.icon}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {project.name}
        </span>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {counts.map((count) => (
            <span key={count.label} className="whitespace-nowrap">
              <span className="font-medium text-foreground">{count.value}</span>{" "}
              {count.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <UnarchiveButton id={project._id} name={project.name} />
        <DeleteProjectDialog
          id={project._id}
          name={project.name}
          trigger={
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    aria-label="Delete project"
                    data-testid="delete-project-trigger"
                    size="icon-sm"
                    variant="destructive"
                  >
                    <Trash2 />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Delete permanently</TooltipContent>
            </Tooltip>
          }
        />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <Card className="items-center justify-center gap-3 border border-dashed py-12 text-center shadow-none ring-0">
      <CardContent className="flex flex-col items-center gap-3">
        <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Inbox className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">No archived projects</p>
          <p className="text-sm text-muted-foreground">
            Archive a project from its menu to tuck it away here.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
