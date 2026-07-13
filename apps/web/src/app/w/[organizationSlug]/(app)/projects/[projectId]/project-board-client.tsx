"use client"

import { useState } from "react"

import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { dataFromError, messageFromError } from "@/lib/errors"
import { moveTaskOptimistic } from "@/lib/optimistic"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { workspaceHref } from "@/lib/workspace"

import {
  positionFor,
  type Status,
} from "@/components/project-board/board-shared"
import { KanbanBoard } from "@/components/project-board/kanban-board"
import { NewTaskDialog } from "@/components/project-board/new-task-dialog"
import { TaskDialog } from "@/components/project-board/task-dialog"

export function ProjectBoardClient({ projectId }: { projectId: string }) {
  const params = useParams()
  const projectIdArg = projectId as Id<"projects">
  const organizationSlug =
    typeof params.organizationSlug === "string" ? params.organizationSlug : ""
  const projectHref = workspaceHref(organizationSlug, `/projects/${projectId}`)
  const project = useQuery(api.projects.get, { projectId: projectIdArg })
  const tasks = useQuery(api.tasks.list, { projectId: projectIdArg })
  const moveTask = useMutation(api.tasks.move).withOptimisticUpdate(
    moveTaskOptimistic(projectIdArg)
  )
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlTaskId = searchParams.get("task") as Id<"tasks"> | null

  // Drive the dialog from local state so it opens instantly on click. A raw
  // window.history.pushState does not reliably re-render useSearchParams in the
  // App Router, so the URL alone can't be trusted to open the modal. We still
  // write the URL for deep links and the back button, then reconcile local
  // state whenever the URL itself changes (back/forward, deep link, project
  // move) by adjusting state during render, per the React docs.
  const [openTaskId, setOpenTaskId] = useState<Id<"tasks"> | null>(urlTaskId)
  const [syncedTaskId, setSyncedTaskId] = useState<Id<"tasks"> | null>(
    urlTaskId
  )
  if (urlTaskId !== syncedTaskId) {
    setSyncedTaskId(urlTaskId)
    setOpenTaskId(urlTaskId)
  }

  // A comment target only applies to the task named in the URL (a deep link),
  // never to a card the user just clicked.
  const commentId =
    openTaskId && openTaskId === urlTaskId
      ? (searchParams.get("comment") as Id<"taskComments"> | null)
      : null

  function openTask(taskId: Id<"tasks">) {
    setOpenTaskId(taskId)
    const next = new URLSearchParams(searchParams.toString())
    next.set("task", taskId)
    next.delete("comment")
    window.history.pushState(
      { ...window.history.state, neramTaskModal: true },
      "",
      `${projectHref}?${next.toString()}`
    )
  }

  function closeTask() {
    setOpenTaskId(null)
    if (window.history.state?.neramTaskModal) {
      router.back()
      return
    }
    router.replace(projectHref, { scroll: false })
  }

  async function handleDrop(
    taskId: Id<"tasks">,
    status: Status,
    insertIndex: number
  ) {
    const moving = tasks?.find((item) => item._id === taskId)
    if (!moving) return
    const dest = (tasks ?? [])
      .filter((item) => item.status === status)
      .sort((a, b) => a.position - b.position)
    // Skip the write when the card is dropped back into its current slot.
    if (moving.status === status) {
      const currentIndex = dest.findIndex((item) => item._id === taskId)
      if (insertIndex === currentIndex || insertIndex === currentIndex + 1) {
        return
      }
    }
    const position = positionFor(dest, insertIndex, taskId)
    try {
      await moveTask({ taskId, status, position })
    } catch (error) {
      const data = dataFromError(error)
      if (
        data?.code === "INCOMPLETE_SUBTASKS" &&
        window.confirm(
          `${String(data.unfinishedCount)} subtasks are unfinished. Move this task to Done anyway?`
        )
      ) {
        await moveTask({
          taskId,
          status,
          position,
          confirmIncompleteSubtasks: true,
        })
        return
      }
      toast.error(messageFromError(error, "Could not move the task."))
    }
  }

  if (project === undefined || tasks === undefined) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  if (project === null) {
    return (
      <section className="mx-auto grid w-full max-w-7xl gap-4 p-5">
        <Button asChild className="w-fit" size="sm" variant="ghost">
          <Link href={workspaceHref(organizationSlug)}>
            <ArrowLeft /> Back to projects
          </Link>
        </Button>
        <Card className="items-center gap-2 border border-dashed py-12 text-center shadow-none ring-0">
          <CardContent className="space-y-1">
            <p className="font-medium">Project not found</p>
            <p className="text-sm text-muted-foreground">
              It may have been removed, or the link is incorrect.
            </p>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-5 p-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate font-heading text-lg font-medium">
          {project.name}
        </h1>
        <NewTaskDialog projectId={projectIdArg} />
      </div>
      <KanbanBoard onDrop={handleDrop} onOpenTask={openTask} tasks={tasks} />
      <TaskDialog
        commentId={commentId}
        onClose={closeTask}
        onProjectChange={(nextProjectId) => {
          if (!openTaskId) return
          const next = new URLSearchParams(searchParams.toString())
          next.set("task", openTaskId)
          window.history.replaceState(
            window.history.state,
            "",
            `${workspaceHref(
              organizationSlug,
              `/projects/${nextProjectId}`
            )}?${next.toString()}`
          )
        }}
        taskId={openTaskId}
      />
    </section>
  )
}
