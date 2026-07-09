"use client"

import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import Link from "next/link"
import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { messageFromError } from "@/lib/errors"
import { moveTaskOptimistic } from "@/lib/optimistic"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

import {
  positionFor,
  type Status,
} from "@/components/project-board/board-shared"
import { KanbanBoard } from "@/components/project-board/kanban-board"
import { NewTaskDialog } from "@/components/project-board/new-task-dialog"
import { TaskDialog } from "@/components/project-board/task-dialog"

export function ProjectBoardClient({ projectId }: { projectId: string }) {
  const projectIdArg = projectId as Id<"projects">
  const project = useQuery(api.projects.get, { projectId: projectIdArg })
  const tasks = useQuery(api.tasks.list, { projectId: projectIdArg })
  const moveTask = useMutation(api.tasks.move).withOptimisticUpdate(
    moveTaskOptimistic(projectIdArg)
  )
  // The opened task dialog is tracked here (not inside each card) so it stays
  // open when a status change moves the card into a different column, which
  // would otherwise unmount the card and its dialog.
  const [openTaskId, setOpenTaskId] = useState<Id<"tasks"> | null>(null)

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
          <Link href="/dashboard">
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
      <KanbanBoard
        onDrop={handleDrop}
        onOpenTask={setOpenTaskId}
        tasks={tasks}
      />
      <TaskDialog
        onOpenChange={(next) => {
          if (!next) setOpenTaskId(null)
        }}
        open={openTaskId !== null}
        task={tasks.find((task) => task._id === openTaskId) ?? null}
      />
    </section>
  )
}
