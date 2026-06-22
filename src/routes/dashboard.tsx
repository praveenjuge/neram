import { useQuery } from "convex-helpers/react/cache"
import {
  FolderPlus,
  ListChecks,
  LogOut,
  Pencil,
  Plus,
  Share2,
} from "lucide-react"

import { Link, createFileRoute } from "@tanstack/react-router"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import {
  AddTaskDialog,
  EditProjectDialog,
  LeaveProjectDialog,
  NewProjectDialog,
  ShareProjectDialog,
} from "@/components/project-dialogs"
import { useProjectPrefetch } from "@/lib/prefetch"
import { getProjectColorText } from "@/lib/project-colors"
import { ProjectIcon } from "@/lib/project-icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DialogTrigger } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
          <NewProjectDialog
            trigger={
              <DialogTrigger asChild>
                <Button data-testid="new-project-trigger">
                  <FolderPlus /> New project
                </Button>
              </DialogTrigger>
            }
          />
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
  // Only surface buckets that actually have tasks so the card stays quiet.
  const counts = [
    { label: "Todo", value: project.todoCount },
    { label: "Doing", value: project.inProgressCount },
    { label: "Done", value: project.doneCount },
  ].filter((count) => count.value > 0)
  return (
    <Card className="h-full shadow-none" size="sm">
      <Link
        className="flex flex-1 flex-col gap-(--card-spacing)"
        data-testid="project-card"
        onFocus={() => prefetch(project.id)}
        onMouseEnter={() => prefetch(project.id)}
        params={{ projectId: project.id }}
        to="/projects/$projectId"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ProjectIcon
              className={cn(
                "size-4 shrink-0",
                getProjectColorText(project.color)
              )}
              name={project.icon}
            />
            <span className="truncate">{project.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {counts.length === 0 ? (
            <span>No tasks yet</span>
          ) : (
            counts.map((count) => (
              <span key={count.label}>
                <span className="font-medium text-foreground">
                  {count.value}
                </span>{" "}
                {count.label}
              </span>
            ))
          )}
        </CardContent>
      </Link>
      <CardFooter className="gap-1">
        <AddTaskDialog
          id={project.id}
          name={project.name}
          trigger={
            <DialogTrigger asChild>
              <Button
                data-testid="add-task-trigger"
                size="sm"
                variant="outline"
              >
                <Plus /> Add task
              </Button>
            </DialogTrigger>
          }
        />
        <div className="ml-auto flex items-center gap-0.5">
          <EditProjectDialog
            color={project.color}
            icon={project.icon}
            id={project.id}
            name={project.name}
            role={project.role}
            trigger={
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button
                      aria-label="Edit project"
                      data-testid="edit-project-trigger"
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Pencil />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Edit project</TooltipContent>
              </Tooltip>
            }
          />
          {project.role === "owner" ? (
            <ShareProjectDialog
              id={project.id}
              name={project.name}
              trigger={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button
                        aria-label="Share project"
                        data-testid="share-project-trigger"
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Share2 />
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Share project</TooltipContent>
                </Tooltip>
              }
            />
          ) : (
            <LeaveProjectDialog
              id={project.id}
              name={project.name}
              trigger={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button
                        aria-label="Leave project"
                        data-testid="leave-project-trigger"
                        size="icon-sm"
                        variant="ghost"
                      >
                        <LogOut />
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Leave project</TooltipContent>
                </Tooltip>
              }
            />
          )}
        </div>
      </CardFooter>
    </Card>
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
