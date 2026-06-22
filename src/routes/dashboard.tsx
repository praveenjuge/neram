import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import {
  ChevronsUpDown,
  FolderPlus,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
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
  createTaskOptimistic,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
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
      <AppHeader
        actions={<NewProjectDialog />}
        crumb={<AllProjectsSwitcher />}
        title="Neram"
      />
      <section className="mx-auto grid max-w-6xl gap-6 p-5">
        {projects === undefined ? (
          <div className="grid min-h-[40vh] place-items-center">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
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

function AllProjectsSwitcher() {
  const projects = useQuery(api.projects.names)
  const prefetch = useProjectPrefetch()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="font-heading"
          data-testid="all-projects-switcher"
          variant="ghost"
        >
          <span className="truncate">All Projects</span>
          <ChevronsUpDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-80 w-56 overflow-y-auto"
      >
        <DropdownMenuLabel>Go to project</DropdownMenuLabel>
        {projects?.map((project) => (
          <DropdownMenuItem asChild key={project._id}>
            <Link
              onFocus={() => prefetch(project._id)}
              onMouseEnter={() => prefetch(project._id)}
              params={{ projectId: project._id }}
              to="/projects/$projectId"
            >
              <span className="truncate">{project.name}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
    <Card className="h-full transition-shadow hover:shadow-md">
      <Link
        className="flex flex-1 flex-col gap-(--card-spacing) rounded-[min(var(--radius-4xl),24px)] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        data-testid="project-card"
        onFocus={() => prefetch(project.id)}
        onMouseEnter={() => prefetch(project.id)}
        params={{ projectId: project.id }}
        to="/projects/$projectId"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
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
        <CardContent className="flex flex-wrap gap-1">
          <Badge variant="outline">{project.todoCount} Todo</Badge>
          <Badge variant="outline">{project.inProgressCount} Doing</Badge>
          <Badge variant="outline">{project.doneCount} Done</Badge>
        </CardContent>
      </Link>
      <CardFooter className="gap-2 border-t">
        <AddTaskDialog id={project.id} name={project.name} />
        <EditProjectDialog
          color={project.color}
          icon={project.icon}
          id={project.id}
          name={project.name}
        />
      </CardFooter>
    </Card>
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

  function onOpenChange(next: boolean) {
    if (next) {
      // Seed each new project with a random icon + color for a bit of variety.
      setName("")
      setIcon(randomProjectIcon())
      setColor(randomProjectColor())
    }
    setOpen(next)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      toast.error("Project name is required.")
      return
    }

    // Fire optimistically and close immediately: the card is already in the
    // list. A failure rolls back the optimistic insert and surfaces a toast.
    void createProject({ name: nextName.slice(0, 80), icon, color })
      .then(() => toast.success("Project created."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not create the project."))
      )
    setOpen(false)
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
            <IconPicker onChange={setIcon} value={icon} />
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <ColorPicker onChange={setColor} value={color} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button data-testid="create-project-button" type="submit">
              <FolderPlus /> Create project
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

  function onOpenChange(next: boolean) {
    if (next) {
      setNextName(name)
      setNextIcon((icon as ProjectIconName) ?? DEFAULT_PROJECT_ICON)
      setNextColor((color as ProjectColorName) ?? DEFAULT_PROJECT_COLOR)
      setConfirmDelete(false)
    }
    setOpen(next)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = nextName.trim()
    if (!trimmed) {
      toast.error("Project name is required.")
      return
    }

    // Optimistic edit renders instantly, so close right away.
    void updateProject({
      projectId: id,
      name: trimmed.slice(0, 80),
      icon: nextIcon,
      color: nextColor,
    })
      .then(() => toast.success("Project updated."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not update the project."))
      )
    setOpen(false)
  }

  function onDelete() {
    // Optimistic remove drops the card immediately; close and let it run.
    void deleteProject({ projectId: id })
      .then(() => toast.success("Project deleted."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not delete the project."))
      )
    setOpen(false)
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-label="Edit project"
          data-testid="edit-project-trigger"
          size="sm"
          variant="outline"
        >
          <Pencil /> Edit
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
            <IconPicker onChange={setNextIcon} value={nextIcon} />
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <ColorPicker onChange={setNextColor} value={nextColor} />
          </div>
          {confirmDelete ? (
            <div className="grid gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-muted-foreground">
                This permanently deletes the project and all of its tasks.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setConfirmDelete(false)}
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  data-testid="confirm-delete-project-button"
                  onClick={onDelete}
                  type="button"
                  variant="destructive"
                >
                  <Trash2 /> Delete project
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            <Button
              className={confirmDelete ? "invisible" : undefined}
              data-testid="delete-project-trigger"
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
              <Button data-testid="save-project-button" type="submit">
                Save changes
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type AddTaskDialogProps = {
  id: Id<"projects">
  name: string
}

function AddTaskDialog({ id, name }: AddTaskDialogProps) {
  const createTask = useMutation(api.tasks.create).withOptimisticUpdate(
    createTaskOptimistic(id)
  )
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")

  function onOpenChange(next: boolean) {
    if (next) {
      setTitle("")
      setDueDate("")
    }
    setOpen(next)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) {
      toast.error("Task title is required.")
      return
    }

    // Fire optimistically: the project's Todo count bumps immediately on the
    // dashboard card, and a failure rolls it back with a toast.
    void createTask({
      projectId: id,
      title: nextTitle.slice(0, 120),
      dueDate: dueDate || undefined,
    })
      .then(() => toast.success("Task added."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not add the task."))
      )
    setOpen(false)
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button data-testid="add-task-trigger" size="sm">
          <Plus /> Add task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add task</DialogTitle>
          <DialogDescription>
            New tasks start in the Todo column of {name}.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor={`add-task-title-${id}`}>Title</Label>
            <Input
              autoFocus
              data-testid="add-task-title-input"
              id={`add-task-title-${id}`}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Draft the homepage copy"
              value={title}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`add-task-due-date-${id}`}>
              Due date (optional)
            </Label>
            <Input
              data-testid="add-task-due-date-input"
              id={`add-task-due-date-${id}`}
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
            <Button data-testid="add-task-button" type="submit">
              <Plus /> Add task
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
