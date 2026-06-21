import { useMutation, useQuery } from "convex/react"
import { CalendarDays, FolderPlus, ListChecks } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"

import { Link, createFileRoute } from "@tanstack/react-router"
import { api } from "../../convex/_generated/api"
import { messageFromError } from "@/lib/errors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
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

  return (
    <main className="min-h-svh bg-background">
      <AppHeader actions={<NewProjectDialog />} title="Neram" />
      <section className="mx-auto grid max-w-6xl gap-6 p-5">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-medium">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Your personal boards, sorted by most recently updated.
          </p>
        </div>

        {projects === undefined ? (
          <ProjectGridSkeleton />
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                createdAt={project.updatedAt}
                doneCount={project.doneCount}
                id={project._id}
                inProgressCount={project.inProgressCount}
                key={project._id}
                name={project.name}
                taskCount={project.taskCount}
                todoCount={project.todoCount}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

type ProjectCardProps = {
  id: string
  name: string
  taskCount: number
  todoCount: number
  inProgressCount: number
  doneCount: number
  createdAt: number
}

function ProjectCard(project: ProjectCardProps) {
  return (
    <Link
      className="group rounded-[min(var(--radius-4xl),24px)] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      data-testid="project-card"
      params={{ projectId: project.id }}
      to="/projects/$projectId"
    >
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="truncate">{project.name}</span>
            <Badge variant="secondary">
              <ListChecks /> {project.taskCount}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{project.todoCount} Todo</Badge>
          <Badge variant="outline">{project.inProgressCount} Doing</Badge>
          <Badge variant="outline">{project.doneCount} Done</Badge>
        </CardContent>
        <CardFooter>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            Updated {new Date(project.createdAt).toLocaleString()}
          </p>
        </CardFooter>
      </Card>
    </Link>
  )
}

function NewProjectDialog() {
  const createProject = useMutation(api.projects.create)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      toast.error("Project name is required.")
      return
    }

    setSubmitting(true)
    try {
      await createProject({ name: nextName.slice(0, 80) })
      toast.success("Project created.")
      setName("")
      setOpen(false)
    } catch (error) {
      toast.error(messageFromError(error, "Could not create the project."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button data-testid="new-project-trigger">
          <FolderPlus /> New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Give your board a name. You can add tasks once it is created.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              autoFocus
              data-testid="project-name-input"
              id="project-name"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Website redesign"
              value={name}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              data-testid="create-project-button"
              disabled={submitting}
              type="submit"
            >
              <FolderPlus /> {submitting ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EmptyState() {
  return (
    <Card className="items-center justify-center gap-3 border border-dashed py-12 text-center shadow-none ring-0">
      <CardContent className="flex flex-col items-center gap-3">
        <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <ListChecks className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">No projects yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first project to open a kanban board.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ProjectGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-2/3" />
          </CardHeader>
          <CardContent className="flex gap-1.5">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-3.5 w-40" />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
