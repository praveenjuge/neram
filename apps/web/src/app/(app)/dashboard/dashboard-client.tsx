"use client"

import { useQuery } from "convex-helpers/react/cache"
import type { FunctionReturnType } from "convex/server"
import { FolderPlus, ListChecks, LogOut, Pencil, Plus, Share2 } from "lucide-react"

import Link from "next/link"
import { api } from "@neram/convex/api"
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
import { Card, CardContent } from "@/components/ui/card"
import { DialogTrigger } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type DashboardProject = FunctionReturnType<typeof api.projects.list>[number]

export function DashboardClient() {
  // The list already arrives ordered by most recently updated first, so the
  // freshest projects surface at the top with no client-side grouping.
  const projects = useQuery(api.projects.list)

  return (
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
        <div
          className="grid gap-0 divide-y divide-border rounded-lg border"
          data-testid="dashboard-project-list"
        >
          {projects.map((project) => (
            <ProjectRow key={project._id} project={project} />
          ))}
        </div>
      )}
    </section>
  )
}

function ProjectRow({ project }: { project: DashboardProject }) {
  const prefetch = useProjectPrefetch()
  const counts = [
    { label: "Todo", value: project.todoCount },
    { label: "Doing", value: project.inProgressCount },
    { label: "Done", value: project.doneCount },
  ]

  return (
    <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
      <Link
        className="flex min-w-0 flex-1 items-center gap-3"
        data-testid="project-card"
        href={`/projects/${project._id}`}
        onFocus={() => prefetch(project._id)}
        onMouseEnter={() => prefetch(project._id)}
      >
        <ProjectIcon
          className={cn("size-4 shrink-0", getProjectColorText(project.color))}
          name={project.icon}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {project.name}
        </span>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {counts.map((count) => (
            <span key={count.label} className="whitespace-nowrap">
              <span className="font-medium text-foreground">
                {count.value}
              </span>{" "}
              {count.label}
            </span>
          ))}
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-0.5">
        <AddTaskDialog
          id={project._id}
          name={project.name}
          trigger={
            <DialogTrigger asChild>
              <Button
                data-testid="add-task-trigger"
                size="icon-sm"
                variant="ghost"
              >
                <Plus />
              </Button>
            </DialogTrigger>
          }
        />
        <EditProjectDialog
          color={project.color}
          icon={project.icon}
          id={project._id}
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
            id={project._id}
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
            id={project._id}
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
    </div>
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
