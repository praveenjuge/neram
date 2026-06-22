import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import { ArrowLeft, CalendarClock, Plus } from "lucide-react"
import type { FunctionReturnType } from "convex/server"
import type { FormEvent } from "react"
import { Fragment, useState } from "react"
import { toast } from "sonner"

import { Link, createFileRoute } from "@tanstack/react-router"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { messageFromError } from "@/lib/errors"
import { createTaskOptimistic, moveTaskOptimistic } from "@/lib/optimistic"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AppLayout, Protected } from "./-components"

const columns = [
  { key: "todo", label: "Todo" },
  { key: "inProgress", label: "In Progress" },
  { key: "done", label: "Done" },
] as const

type Status = (typeof columns)[number]["key"]
type Task = FunctionReturnType<typeof api.tasks.list>[number]

/**
 * Computes the fractional `position` for a task dropped at `insertIndex` within
 * a destination column. `dest` is the column's tasks sorted by position (it may
 * still contain the moving task when reordering within the same column).
 */
function positionFor(dest: Task[], insertIndex: number, movingId: Id<"tasks">) {
  const list = dest.filter((task) => task._id !== movingId)
  let adjusted = 0
  for (let i = 0; i < insertIndex && i < dest.length; i++) {
    if (dest[i]._id !== movingId) adjusted++
  }
  const before = list[adjusted - 1]
  const after = list[adjusted]
  if (!before && !after) return Date.now()
  if (!before) return after.position - 1
  if (!after) return before.position + 1
  return (before.position + after.position) / 2
}

function DropIndicator() {
  return <div className="h-0.5 rounded-full bg-primary/70" />
}

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
                  <h2 className="text-sm font-medium">{column.label}</h2>
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
                        task={task}
                      />
                    </Fragment>
                  ))}
                  {isOver && overIndex === columnTasks.length ? (
                    <DropIndicator />
                  ) : null}
                  {columnTasks.length === 0 ? (
                    <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
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
      </section>
    </AppLayout>
  )
}

function TaskCard({
  task,
  isDragging,
  onDragStart,
  onDragEnd,
  onHover,
}: {
  task: Task
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onHover: () => void
}) {
  const moveTask = useMutation(api.tasks.move).withOptimisticUpdate(
    moveTaskOptimistic(task.projectId)
  )

  async function onMove(status: Status) {
    if (status === task.status) return
    try {
      await moveTask({ taskId: task._id, status })
    } catch (error) {
      toast.error(messageFromError(error, "Could not move the task."))
    }
  }

  return (
    <Card
      className={cn(
        "cursor-grab gap-2 transition-opacity active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
      data-testid="task-card"
      draggable
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
        onHover()
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", task._id)
        onDragStart()
      }}
      size="sm"
    >
      <CardContent className="space-y-2">
        <p className="text-sm font-medium">{task.title}</p>
        {task.dueDate ? (
          <Badge variant="outline">
            <CalendarClock /> Due {task.dueDate}
          </Badge>
        ) : null}
      </CardContent>
      <CardFooter className="justify-end">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  data-testid="move-task-button"
                  size="sm"
                  variant="outline"
                >
                  Move
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Move to another column</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              onValueChange={(value) => onMove(value as Status)}
              value={task.status}
            >
              {columns.map((column) => (
                <DropdownMenuRadioItem
                  key={column.key}
                  data-testid={`move-to-${column.key}`}
                  value={column.key}
                >
                  {column.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  )
}

function NewTaskDialog({ projectId }: { projectId: Id<"projects"> }) {
  const createTask = useMutation(api.tasks.create).withOptimisticUpdate(
    createTaskOptimistic(projectId)
  )
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")

  function reset() {
    setTitle("")
    setDueDate("")
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) {
      toast.error("Task title is required.")
      return
    }

    // Fire optimistically: the card appears instantly, so close the dialog now
    // and surface only failures. The optimistic update rolls back on error.
    void createTask({
      projectId,
      title: nextTitle.slice(0, 120),
      dueDate: dueDate || undefined,
    })
      .then(() => toast.success("Task added."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not add the task."))
      )
    reset()
    setOpen(false)
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button data-testid="new-task-trigger">
          <Plus /> Add task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add task</DialogTitle>
          <DialogDescription>
            New tasks start in the Todo column.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              autoFocus
              data-testid="task-title-input"
              id="task-title"
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Draft the homepage copy"
              value={title}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-due-date">Due date (optional)</Label>
            <Input
              data-testid="task-due-date-input"
              id="task-due-date"
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button data-testid="create-task-button" type="submit">
              <Plus /> Add task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
