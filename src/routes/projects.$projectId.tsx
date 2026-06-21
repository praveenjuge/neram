import { useMutation, useQuery } from "convex/react"
import {
  ArrowLeft,
  CalendarClock,
  ChevronsUpDown,
  LayoutGrid,
  Plus,
} from "lucide-react"
import type { FunctionReturnType } from "convex/server"
import type { FormEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"

import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { messageFromError } from "@/lib/errors"
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AppHeader, Protected } from "./-components"

const columns = [
  { key: "todo", label: "Todo" },
  { key: "inProgress", label: "In Progress" },
  { key: "done", label: "Done" },
] as const

type Status = (typeof columns)[number]["key"]
type Task = FunctionReturnType<typeof api.tasks.list>[number]

const statusLabels: Record<Status, string> = {
  todo: "Todo",
  inProgress: "In Progress",
  done: "Done",
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
  const moveTask = useMutation(api.tasks.move)
  const [draggingId, setDraggingId] = useState<Id<"tasks"> | null>(null)
  const [overColumn, setOverColumn] = useState<Status | null>(null)

  async function handleDrop(taskId: Id<"tasks">, status: Status) {
    setOverColumn(null)
    setDraggingId(null)
    const task = tasks?.find((item) => item._id === taskId)
    if (!task || task.status === status) return
    try {
      await moveTask({ taskId, status })
      toast.success(`Moved to ${statusLabels[status]}.`)
    } catch (error) {
      toast.error(messageFromError(error, "Could not move the task."))
    }
  }

  if (project === undefined || tasks === undefined) {
    return (
      <main className="min-h-svh bg-background">
        <AppHeader title="Neram" />
        <BoardSkeleton />
      </main>
    )
  }

  if (project === null) {
    return (
      <main className="min-h-svh bg-background">
        <AppHeader title="Neram" />
        <section className="mx-auto grid max-w-7xl gap-4 p-5">
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
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-background">
      <AppHeader
        actions={<NewTaskDialog projectId={projectIdArg} />}
        crumb={
          <ProjectSwitcher
            currentId={projectIdArg}
            currentName={project.name}
          />
        }
        title="Neram"
      />
      <section className="mx-auto grid max-w-7xl gap-5 p-5">
        <div className="grid gap-3 lg:grid-cols-3">
          {columns.map((column) => {
            const columnTasks = tasks.filter(
              (task) => task.status === column.key
            )
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
                  if (taskId) void handleDrop(taskId, column.key)
                }}
              >
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-medium">{column.label}</h2>
                  <Badge variant="secondary">{columnTasks.length}</Badge>
                </div>
                <div className="grid gap-2">
                  {columnTasks.map((task) => (
                    <TaskCard
                      isDragging={draggingId === task._id}
                      key={task._id}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setOverColumn(null)
                      }}
                      onDragStart={() => setDraggingId(task._id)}
                      task={task}
                    />
                  ))}
                  {columnTasks.length === 0 ? (
                    <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                      Nothing here yet.
                    </p>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      </section>
    </main>
  )
}

function ProjectSwitcher({
  currentId,
  currentName,
}: {
  currentId: Id<"projects">
  currentName: string
}) {
  const projects = useQuery(api.projects.list)
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="font-heading"
          data-testid="project-switcher"
          variant="ghost"
        >
          <span className="truncate">{currentName}</span>
          <ChevronsUpDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-80 w-56 overflow-y-auto"
      >
        <DropdownMenuLabel>Switch project</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            if (value !== currentId) {
              void navigate({
                to: "/projects/$projectId",
                params: { projectId: value },
              })
            }
          }}
          value={currentId}
        >
          {projects?.map((project) => (
            <DropdownMenuRadioItem
              data-testid={`switch-to-${project._id}`}
              key={project._id}
              value={project._id}
            >
              <span className="truncate">{project.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/dashboard">
            <LayoutGrid /> All projects
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TaskCard({
  task,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  task: Task
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const moveTask = useMutation(api.tasks.move)

  async function onMove(status: Status) {
    if (status === task.status) return
    try {
      await moveTask({ taskId: task._id, status })
      toast.success(`Moved to ${statusLabels[status]}.`)
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
  const createTask = useMutation(api.tasks.create)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setTitle("")
    setDueDate("")
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) {
      toast.error("Task title is required.")
      return
    }

    setSubmitting(true)
    try {
      await createTask({
        projectId,
        title: nextTitle.slice(0, 120),
        dueDate: dueDate || undefined,
      })
      toast.success("Task added.")
      reset()
      setOpen(false)
    } catch (error) {
      toast.error(messageFromError(error, "Could not add the task."))
    } finally {
      setSubmitting(false)
    }
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
            <Button
              data-testid="create-task-button"
              disabled={submitting}
              type="submit"
            >
              <Plus /> {submitting ? "Adding..." : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BoardSkeleton() {
  return (
    <section className="mx-auto grid max-w-7xl gap-5 p-5">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {columns.map((column) => (
          <div
            className="flex min-h-72 flex-col gap-3 rounded-[min(var(--radius-4xl),24px)] bg-muted/40 p-3"
            key={column.key}
          >
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    </section>
  )
}
