import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import { ArrowLeft } from "lucide-react"
import { Fragment, useState } from "react"
import { toast } from "sonner"

import { Link, createFileRoute } from "@tanstack/react-router"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { messageFromError } from "@/lib/errors"
import { moveTaskOptimistic } from "@/lib/optimistic"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

import { AppLayout, Protected } from "./-components"
import {
  columns,
  DropIndicator,
  positionFor,
  type Status,
} from "./-project-board/board-shared"
import { NewTaskDialog } from "./-project-board/new-task-dialog"
import { TaskCard } from "./-project-board/task-card"
import { TaskDialog } from "./-project-board/task-dialog"

export const Route = createFileRoute("/projects/$projectId")({
  component: () => (
    <Protected>
      <Board />
    </Protected>
  ),
})

function Board() {
  const { projectId } = Route.useParams()
  const projectIdArg = projectId as Id<"projects">
  const project = useQuery(api.projects.get, { projectId: projectIdArg })
  const tasks = useQuery(api.tasks.list, { projectId: projectIdArg })
  const moveTask = useMutation(api.tasks.move).withOptimisticUpdate(
    moveTaskOptimistic(projectIdArg)
  )
  const [draggingId, setDraggingId] = useState<Id<"tasks"> | null>(null)
  const [overColumn, setOverColumn] = useState<Status | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  // The opened task dialog is tracked here (not inside each card) so it stays
  // open when a status change moves the card into a different column, which
  // would otherwise unmount the card and its dialog.
  const [openTaskId, setOpenTaskId] = useState<Id<"tasks"> | null>(null)

  async function handleDrop(
    taskId: Id<"tasks">,
    status: Status,
    insertIndex: number
  ) {
    setOverColumn(null)
    setOverIndex(null)
    setDraggingId(null)
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
      <AppLayout>
        <div className="grid min-h-[60vh] place-items-center">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  if (project === null) {
    return (
      <AppLayout>
        <section className="mx-auto grid w-full max-w-7xl gap-4 p-5">
          <Button asChild className="w-fit" size="sm" variant="ghost">
            <Link to="/dashboard">
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
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <section className="mx-auto grid w-full max-w-7xl gap-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="truncate font-heading text-lg font-medium">
            {project.name}
          </h1>
          <NewTaskDialog projectId={projectIdArg} />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {columns.map((column) => {
            const columnTasks = tasks
              .filter((task) => task.status === column.key)
              .sort((a, b) => a.position - b.position)
            const isOver = overColumn === column.key
            return (
              <section
                aria-label={`${column.label} column`}
                className={cn(
                  "flex min-h-72 flex-col gap-3 rounded-[min(var(--radius-4xl),24px)] bg-muted/40 p-3 transition-colors",
                  isOver && "bg-muted ring-2 ring-primary/40"
                )}
                data-testid={`column-${column.key}`}
                key={column.key}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(
                      event.relatedTarget as Node | null
                    )
                  ) {
                    setOverColumn((current) =>
                      current === column.key ? null : current
                    )
                    setOverIndex(null)
                  }
                }}
                onDragOver={(event) => {
                  if (!draggingId) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"
                  if (overColumn !== column.key) setOverColumn(column.key)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  const taskId = event.dataTransfer.getData(
                    "text/plain"
                  ) as Id<"tasks">
                  const insertIndex =
                    overColumn === column.key && overIndex !== null
                      ? overIndex
                      : columnTasks.length
                  if (taskId) void handleDrop(taskId, column.key, insertIndex)
                }}
              >
                <div className="flex items-center justify-between px-1">
                  <h2 className="flex items-center gap-2 text-sm font-medium">
                    <column.icon className="size-4 text-muted-foreground" />
                    {column.label}
                  </h2>
                  <Badge variant="secondary">{columnTasks.length}</Badge>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {columnTasks.map((task, index) => (
                    <Fragment key={task._id}>
                      {isOver && overIndex === index ? <DropIndicator /> : null}
                      <TaskCard
                        isDragging={draggingId === task._id}
                        onDragEnd={() => {
                          setDraggingId(null)
                          setOverColumn(null)
                          setOverIndex(null)
                        }}
                        onDragStart={() => setDraggingId(task._id)}
                        onHover={() => {
                          setOverColumn(column.key)
                          setOverIndex(index)
                        }}
                        onOpen={() => setOpenTaskId(task._id)}
                        task={task}
                      />
                    </Fragment>
                  ))}
                  {isOver && overIndex === columnTasks.length ? (
                    <DropIndicator />
                  ) : null}
                  {columnTasks.length === 0 ? (
                    <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                      Nothing here yet.
                    </p>
                  ) : null}
                  <div
                    aria-hidden
                    className="min-h-8 flex-1"
                    onDragOver={(event) => {
                      if (!draggingId) return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = "move"
                      setOverColumn(column.key)
                      setOverIndex(columnTasks.length)
                    }}
                  />
                </div>
              </section>
            )
          })}
        </div>
        <TaskDialog
          onOpenChange={(next) => {
            if (!next) setOpenTaskId(null)
          }}
          open={openTaskId !== null}
          task={tasks.find((task) => task._id === openTaskId) ?? null}
        />
      </section>
    </AppLayout>
  )
}
