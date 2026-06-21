import { useMutation, useQuery } from "convex/react"
import { CalendarDays, FolderPlus, ListChecks } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"

import { Link, createFileRoute } from "@tanstack/react-router"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { AppHeader, Protected } from "./-components"

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <Protected>
      <Dashboard />
    </Protected>
  ),
})

function Dashboard() {
  const projects = useQuery(api.projects.list)
  const createProject = useMutation(api.projects.create)
  const [name, setName] = useState("")
  const [error, setError] = useState("")

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const form = event.currentTarget
    const formData = new FormData(form)
    const nextName = String(formData.get("name") ?? "").trim()
    if (!nextName) return setError("Project name is required.")
    await createProject({ name: nextName.slice(0, 80) })
    setName("")
  }

  return (
    <main className="min-h-svh bg-background">
      <AppHeader title="Neram" />
      <section className="mx-auto grid max-w-6xl gap-6 p-5">
        <form className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row" onSubmit={onSubmit}>
          <input
            aria-label="Project name"
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            data-testid="project-name-input"
            maxLength={80}
            name="name"
            onChange={(event) => setName(event.target.value)}
            placeholder="New project"
            value={name}
          />
          <Button data-testid="create-project-button">
            <FolderPlus /> Create
          </Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <Link
              className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
              data-testid="project-card"
              key={project._id}
              params={{ projectId: project._id }}
              to="/projects/$projectId"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-medium">{project.name}</h2>
                <ListChecks className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                <Count label="All" value={project.taskCount} />
                <Count label="Todo" value={project.todoCount} />
                <Count label="Doing" value={project.inProgressCount} />
                <Count label="Done" value={project.doneCount} />
              </div>
              <p className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="size-3" /> {new Date(project.updatedAt).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
        {projects && projects.length === 0 ? (
          <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            Create your first project to open a kanban board.
          </p>
        ) : null}
      </section>
    </main>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <strong className="block text-base font-medium text-foreground">{value}</strong>
      {label}
    </span>
  )
}
