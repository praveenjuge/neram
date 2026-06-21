import { useMutation, useQuery } from "convex/react"
import { ArrowLeft, ArrowRight, Plus } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"

import { Link, createFileRoute } from "@tanstack/react-router"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { AppHeader, Protected } from "./-components"

const columns = [
  { key: "todo", label: "Todo" },
  { key: "inProgress", label: "In Progress" },
  { key: "done", label: "Done" },
] as const

type Status = (typeof columns)[number]["key"]

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
  const createTask = useMutation(api.tasks.create)
  const moveTask = useMutation(api.tasks.move)
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [error, setError] = useState("")

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")
    const nextTitle = title.trim()
    if (!nextTitle) return setError("Task title is required.")
    await createTask({ projectId: projectIdArg, title: nextTitle.slice(0, 120), dueDate: dueDate || undefined })
    setTitle("")
    setDueDate("")
  }

  if (project === undefined || tasks === undefined) return <main className="p-6 text-sm">Loading...</main>
  if (project === null) return <main className="p-6 text-sm">Project not found.</main>

  return (
    <main className="min-h-svh bg-background">
      <AppHeader title="Neram" />
      <section className="mx-auto grid max-w-7xl gap-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link className="text-sm text-muted-foreground hover:text-foreground" to="/dashboard">
              Back to projects
            </Link>
            <h1 className="mt-1 text-xl font-medium">{project.name}</h1>
          </div>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSubmit}>
            <input
              aria-label="Task title"
              className="h-9 min-w-56 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              data-testid="task-title-input"
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="New task"
              value={title}
            />
            <input
              aria-label="Due date"
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              data-testid="task-due-date-input"
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
            <Button data-testid="create-task-button">
              <Plus /> Add
            </Button>
          </form>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-3 lg:grid-cols-3">
          {columns.map((column) => (
            <section className="min-h-72 rounded-lg border bg-muted/25 p-3" data-testid={`column-${column.key}`} key={column.key}>
              <h2 className="mb-3 text-sm font-medium">{column.label}</h2>
              <div className="grid gap-2">
                {tasks
                  .filter((task) => task.status === column.key)
                  .map((task) => (
                    <article className="rounded-md border bg-background p-3 text-sm" data-testid="task-card" key={task._id}>
                      <p className="font-medium">{task.title}</p>
                      {task.dueDate ? <p className="mt-1 text-xs text-muted-foreground">Due {task.dueDate}</p> : null}
                      <div className="mt-3 flex gap-1">
                        <MoveButton direction="back" disabled={column.key === "todo"} onClick={() => moveTask({ taskId: task._id, status: previous(column.key) })} />
                        <MoveButton direction="next" disabled={column.key === "done"} onClick={() => moveTask({ taskId: task._id, status: next(column.key) })} />
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  )
}

function previous(status: Status): Status {
  return status === "done" ? "inProgress" : "todo"
}

function next(status: Status): Status {
  return status === "todo" ? "inProgress" : "done"
}

function MoveButton({ direction, disabled, onClick }: { direction: "back" | "next"; disabled: boolean; onClick: () => void }) {
  const label = direction === "back" ? "Move back" : "Move next"
  return (
    <Button aria-label={label} data-testid={direction === "back" ? "move-back-button" : "move-next-button"} disabled={disabled} onClick={onClick} size="icon-sm" type="button" variant="outline">
      {direction === "back" ? <ArrowLeft /> : <ArrowRight />}
    </Button>
  )
}
