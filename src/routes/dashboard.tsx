import { useMutation, useQuery } from "convex/react"
import { FolderPlus, ListChecks, Pencil, Trash2 } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"

import { Link, createFileRoute } from "@tanstack/react-router"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { ColorPicker } from "@/components/color-picker"
import { IconPicker } from "@/components/icon-picker"
import { messageFromError } from "@/lib/errors"
import {
  createProjectOptimistic,
  removeProjectOptimistic,
  updateProjectOptimistic,
} from "@/lib/optimistic"
import { useProjectPrefetch } from "@/lib/prefetch"
import {
  DEFAULT_PROJECT_COLOR,
  getProjectColorBox,
  type ProjectColorName,
  randomProjectColor,
} from "@/lib/project-colors"
import {
  DEFAULT_PROJECT_ICON,
  ProjectIcon,
  type ProjectIconName,
  randomProjectIcon,
} from "@/lib/project-icons"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
                color={project.color}
                doneCount={project.doneCount}
                icon={project.icon}
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
  id: Id<"projects">
  name: string
  icon?: string
  color?: string
  taskCount: number
  todoCount: number
  inProgressCount: number
  doneCount: number
}

function ProjectCard(project: ProjectCardProps) {
  const prefetch = useProjectPrefetch()
  return (
    <div className="group relative">
      <Link
        className="block rounded-[min(var(--radius-4xl),24px)] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        data-testid="project-card"
        onFocus={() => prefetch(project.id)}
        onMouseEnter={() => prefetch(project.id)}
        params={{ projectId: project.id }}
        to="/projects/$projectId"
      >
        <Card className="h-full transition-shadow group-hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 pe-9">
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl",
                  getProjectColorBox(project.color)
                )}
              >
                <ProjectIcon className="size-4" name={project.icon} />
              </span>
              <span className="truncate">{project.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">
              <ListChecks /> {project.taskCount}
            </Badge>
            <Badge variant="outline">{project.todoCount} Todo</Badge>
            <Badge variant="outline">{project.inProgressCount} Doing</Badge>
            <Badge variant="outline">{project.doneCount} Done</Badge>
          </CardContent>
        </Card>
      </Link>
      <EditProjectDialog
        color={project.color}
        icon={project.icon}
        id={project.id}
        name={project.name}
      />
    </div>
  )
}

function IconPreview({
  color,
  icon,
}: {
  color: ProjectColorName
  icon: ProjectIconName
}) {
  return (
    <span
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-2xl",
        getProjectColorBox(color)
      )}
      data-testid="project-icon-preview"
    >
      <ProjectIcon className="size-5" name={icon} />
    </span>
  )
}

function NewProjectDialog() {
  const createProject = useMutation(api.projects.create).withOptimisticUpdate(
    createProjectOptimistic
  )
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState<ProjectIconName>(randomProjectIcon)
  const [color, setColor] = useState<ProjectColorName>(randomProjectColor)
  const [submitting, setSubmitting] = useState(false)

  function onOpenChange(next: boolean) {
    if (next) {
      // Seed each new project with a random icon + color for a bit of variety.
      setName("")
      setIcon(randomProjectIcon())
      setColor(randomProjectColor())
    }
    setOpen(next)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      toast.error("Project name is required.")
      return
    }

    setSubmitting(true)
    try {
      await createProject({ name: nextName.slice(0, 80), icon, color })
      toast.success("Project created.")
      setName("")
      setIcon(randomProjectIcon())
      setColor(randomProjectColor())
      setOpen(false)
    } catch (error) {
      toast.error(messageFromError(error, "Could not create the project."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button data-testid="new-project-trigger">
          <FolderPlus /> New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Give your board a name, then pick an icon and color. You can add
            tasks once it is created.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="flex items-center gap-3">
            <IconPreview color={color} icon={icon} />
            <div className="grid flex-1 gap-2">
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
          </div>
          <div className="grid gap-2">
            <Label>Icon</Label>
            <IconPicker disabled={submitting} onChange={setIcon} value={icon} />
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <ColorPicker
              disabled={submitting}
              onChange={setColor}
              value={color}
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

type EditProjectDialogProps = {
  id: Id<"projects">
  name: string
  icon?: string
  color?: string
}

function EditProjectDialog({ id, name, icon, color }: EditProjectDialogProps) {
  const updateProject = useMutation(api.projects.update).withOptimisticUpdate(
    updateProjectOptimistic
  )
  const deleteProject = useMutation(api.projects.remove).withOptimisticUpdate(
    removeProjectOptimistic
  )
  const [open, setOpen] = useState(false)
  const [nextName, setNextName] = useState(name)
  const [nextIcon, setNextIcon] = useState<ProjectIconName>(
    (icon as ProjectIconName) ?? DEFAULT_PROJECT_ICON
  )
  const [nextColor, setNextColor] = useState<ProjectColorName>(
    (color as ProjectColorName) ?? DEFAULT_PROJECT_COLOR
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function onOpenChange(next: boolean) {
    if (next) {
      setNextName(name)
      setNextIcon((icon as ProjectIconName) ?? DEFAULT_PROJECT_ICON)
      setNextColor((color as ProjectColorName) ?? DEFAULT_PROJECT_COLOR)
      setConfirmDelete(false)
    }
    setOpen(next)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = nextName.trim()
    if (!trimmed) {
      toast.error("Project name is required.")
      return
    }

    setSubmitting(true)
    try {
      await updateProject({
        projectId: id,
        name: trimmed.slice(0, 80),
        icon: nextIcon,
        color: nextColor,
      })
      toast.success("Project updated.")
      setOpen(false)
    } catch (error) {
      toast.error(messageFromError(error, "Could not update the project."))
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete() {
    setDeleting(true)
    try {
      await deleteProject({ projectId: id })
      toast.success("Project deleted.")
      setOpen(false)
    } catch (error) {
      toast.error(messageFromError(error, "Could not delete the project."))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-label="Edit project"
          className="absolute end-3 top-3 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          data-testid="edit-project-trigger"
          size="icon-sm"
          variant="ghost"
        >
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            Update the name, icon, and color, or delete this project.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="flex items-center gap-3">
            <IconPreview color={nextColor} icon={nextIcon} />
            <div className="grid flex-1 gap-2">
              <Label htmlFor={`edit-project-name-${id}`}>Project name</Label>
              <Input
                autoFocus
                data-testid="edit-project-name-input"
                id={`edit-project-name-${id}`}
                maxLength={80}
                onChange={(event) => setNextName(event.target.value)}
                placeholder="e.g. Website redesign"
                value={nextName}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Icon</Label>
            <IconPicker
              disabled={submitting || deleting}
              onChange={setNextIcon}
              value={nextIcon}
            />
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <ColorPicker
              disabled={submitting || deleting}
              onChange={setNextColor}
              value={nextColor}
            />
          </div>
          {confirmDelete ? (
            <div className="grid gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-muted-foreground">
                This permanently deletes the project and all of its tasks.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  data-testid="confirm-delete-project-button"
                  disabled={deleting}
                  onClick={onDelete}
                  type="button"
                  variant="destructive"
                >
                  <Trash2 /> {deleting ? "Deleting..." : "Delete project"}
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            <Button
              className={confirmDelete ? "invisible" : undefined}
              data-testid="delete-project-trigger"
              disabled={submitting}
              onClick={() => setConfirmDelete(true)}
              type="button"
              variant="destructive"
            >
              <Trash2 /> Delete
            </Button>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                data-testid="save-project-button"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Saving..." : "Save changes"}
              </Button>
            </div>
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
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          </CardHeader>
          <CardContent className="flex gap-1.5">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
