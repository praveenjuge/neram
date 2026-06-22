import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import {
  Ban,
  Copy,
  FolderPlus,
  ListChecks,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  UserMinus,
  Users,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { AppLayout, Protected } from "./-components"

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
    <AppLayout>
      <section className="mx-auto grid w-full max-w-6xl gap-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-lg font-medium">Projects</h1>
          <NewProjectDialog />
        </div>
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
                role={project.role}
                taskCount={project.taskCount}
                todoCount={project.todoCount}
              />
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  )
}

type ProjectCardProps = {
  id: Id<"projects">
  name: string
  icon?: string
  color?: string
  role: "owner" | "editor"
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
          role={project.role}
        />
        {project.role === "owner" ? (
          <ShareProjectDialog id={project.id} name={project.name} />
        ) : (
          <LeaveProjectButton id={project.id} name={project.name} />
        )}
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
  role: "owner" | "editor"
}

function EditProjectDialog({
  id,
  name,
  icon,
  color,
  role,
}: EditProjectDialogProps) {
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
          {confirmDelete && role === "owner" ? (
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
          <DialogFooter
            className={cn(role === "owner" && "sm:justify-between")}
          >
            {role === "owner" ? (
              <Button
                className={confirmDelete ? "invisible" : undefined}
                data-testid="delete-project-trigger"
                onClick={() => setConfirmDelete(true)}
                type="button"
                variant="destructive"
              >
                <Trash2 /> Delete
              </Button>
            ) : null}
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

function ShareProjectDialog({
  id,
  name,
}: {
  id: Id<"projects">
  name: string
}) {
  const ensureInvite = useMutation(api.invites.ensure)
  const regenerateInvite = useMutation(api.invites.regenerate)
  const revokeInvite = useMutation(api.invites.revoke)
  const removeMember = useMutation(api.members.remove)
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  // Only subscribe to the member list while the dialog is open so the dashboard
  // doesn't hold a members subscription open for every owned card.
  const members = useQuery(api.members.list, open ? { projectId: id } : "skip")

  function onOpenChange(next: boolean) {
    if (next) {
      // Opening Share ensures a link exists, so there's always one to copy.
      setToken(null)
      setWorking(true)
      ensureInvite({ projectId: id })
        .then((value) => setToken(value))
        .catch((error) =>
          toast.error(messageFromError(error, "Could not create the link."))
        )
        .finally(() => setWorking(false))
    }
    setOpen(next)
  }

  const link = token ? `${window.location.origin}/join/${token}` : ""

  async function onCopy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success("Link copied.")
    } catch {
      toast.error("Could not copy the link.")
    }
  }

  async function onGenerate() {
    setWorking(true)
    try {
      setToken(await ensureInvite({ projectId: id }))
      toast.success("Sharing turned on.")
    } catch (error) {
      toast.error(messageFromError(error, "Could not create the link."))
    } finally {
      setWorking(false)
    }
  }

  async function onRegenerate() {
    setWorking(true)
    try {
      setToken(await regenerateInvite({ projectId: id }))
      toast.success("New link generated. The old link no longer works.")
    } catch (error) {
      toast.error(messageFromError(error, "Could not regenerate the link."))
    } finally {
      setWorking(false)
    }
  }

  async function onRevoke() {
    setWorking(true)
    try {
      await revokeInvite({ projectId: id })
      setToken(null)
      toast.success("Sharing turned off.")
    } catch (error) {
      toast.error(messageFromError(error, "Could not revoke the link."))
    } finally {
      setWorking(false)
    }
  }

  async function onRemoveMember(subject: string, displayName: string) {
    try {
      await removeMember({ projectId: id, subject })
      toast.success(`Removed ${displayName}.`)
    } catch (error) {
      toast.error(messageFromError(error, "Could not remove the member."))
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-label="Share project"
          data-testid="share-project-trigger"
          size="sm"
          variant="outline"
        >
          <Share2 /> Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share {name}</DialogTitle>
          <DialogDescription>
            Anyone signed in who opens this link can join as an editor. Editors
            add and edit tasks, but can't delete or re-share the project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label>Invite link</Label>
            {token ? (
              <div className="flex gap-2">
                <Input data-testid="invite-link-input" readOnly value={link} />
                <Button
                  aria-label="Copy link"
                  onClick={onCopy}
                  type="button"
                  variant="outline"
                >
                  <Copy />
                </Button>
              </div>
            ) : working ? (
              <div className="flex h-9 items-center">
                <Spinner className="size-4 text-muted-foreground" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sharing is off. Generate a link to invite collaborators.
              </p>
            )}
            <div className="flex gap-2">
              {token ? (
                <>
                  <Button
                    data-testid="regenerate-invite-button"
                    disabled={working}
                    onClick={onRegenerate}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCw /> Regenerate
                  </Button>
                  <Button
                    data-testid="revoke-invite-button"
                    disabled={working}
                    onClick={onRevoke}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Ban /> Revoke
                  </Button>
                </>
              ) : (
                <Button
                  data-testid="generate-invite-button"
                  disabled={working}
                  onClick={onGenerate}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Share2 /> Generate link
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <Users className="size-4" /> Members
            </Label>
            <ul className="grid gap-1">
              {members === undefined ? (
                <li className="px-1 text-sm text-muted-foreground">Loading…</li>
              ) : (
                members.map((member) => (
                  <li
                    className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
                    key={member.subject}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm">
                        {member.displayName}
                        {member.isYou ? " (you)" : ""}
                      </span>
                      <Badge variant="outline">
                        {member.role === "owner" ? "Owner" : "Editor"}
                      </Badge>
                    </span>
                    {member.role === "editor" ? (
                      <Button
                        aria-label={`Remove ${member.displayName}`}
                        data-testid="remove-member-button"
                        onClick={() =>
                          onRemoveMember(member.subject, member.displayName)
                        }
                        size="sm"
                        variant="ghost"
                      >
                        <UserMinus />
                      </Button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LeaveProjectButton({
  id,
  name,
}: {
  id: Id<"projects">
  name: string
}) {
  const leaveProject = useMutation(api.members.leave).withOptimisticUpdate(
    removeProjectOptimistic
  )
  const [open, setOpen] = useState(false)

  function onLeave() {
    // Optimistic remove drops the card immediately; close and let it run.
    void leaveProject({ projectId: id })
      .then(() => toast.success(`Left ${name}.`))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not leave the project."))
      )
    setOpen(false)
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-label="Leave project"
          data-testid="leave-project-trigger"
          size="sm"
          variant="outline"
        >
          <LogOut /> Leave
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave {name}?</DialogTitle>
          <DialogDescription>
            You'll lose access to this board. You can rejoin later if someone
            shares the link with you again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            data-testid="confirm-leave-project-button"
            onClick={onLeave}
            type="button"
            variant="destructive"
          >
            <LogOut /> Leave project
          </Button>
        </DialogFooter>
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
