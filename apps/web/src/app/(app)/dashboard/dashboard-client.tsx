"use client"

import { useMutation } from "convex/react"
import { useQuery } from "convex-helpers/react/cache"
import type { FunctionReturnType } from "convex/server"
import {
  FolderPlus,
  Heart,
  ListChecks,
  LogOut,
  Pencil,
  Plus,
  Share2,
} from "lucide-react"
import { toast } from "sonner"

import Link from "next/link"
import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import {
  AddTaskDialog,
  EditProjectDialog,
  LeaveProjectDialog,
  NewProjectDialog,
  ShareProjectDialog,
} from "@/components/project-dialogs"
import { messageFromError } from "@/lib/errors"
import { markWorkedOptimistic } from "@/lib/optimistic"
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

type DashboardProject = FunctionReturnType<typeof api.projects.list>[number]

type SectionTone = "recent" | "needsLove"

// How recently a project must have been worked on to stay in "Recently worked".
// After this window of neglect it falls back to "Needs love".
const RECENTLY_WORKED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// Split the dashboard by the caller's personal recency: projects worked on
// within the last week (newest first) versus everything else — stale projects
// they haven't touched in a week plus ones they've never touched. The list
// already arrives sorted by recency, so a straight partition is enough.
function groupByRecency(projects: DashboardProject[]) {
  const cutoff = Date.now() - RECENTLY_WORKED_WINDOW_MS
  const recent = projects.filter(
    (project) =>
      project.lastWorkedAt !== undefined && project.lastWorkedAt >= cutoff
  )
  const needsLove = projects.filter(
    (project) =>
      project.lastWorkedAt === undefined || project.lastWorkedAt < cutoff
  )
  return { recent, needsLove }
}

export function DashboardClient() {
  const projects = useQuery(api.projects.list)
  const groups = projects ? groupByRecency(projects) : null

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
          <div className="grid gap-8">
            <Section
              projects={groups!.recent}
              title="Recently worked"
              tone="recent"
            />
            <Section
              projects={groups!.needsLove}
              title="Needs love"
              tone="needsLove"
            />
          </div>
        )}
    </section>
  )
}

const toneDot: Record<SectionTone, string> = {
  recent: "bg-green-500",
  needsLove: "bg-amber-500",
}

function Section({
  title,
  tone,
  projects,
}: {
  title: string
  tone: SectionTone
  projects: DashboardProject[]
}) {
  if (projects.length === 0) return null
  return (
    <div className="grid gap-3" data-testid={`dashboard-section-${tone}`}>
      <div className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", toneDot[tone])} />
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-xs text-muted-foreground">{projects.length}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project._id} project={project} />
        ))}
      </div>
    </div>
  )
}

function MarkWorkedButton({ id, name }: { id: Id<"projects">; name: string }) {
  const markWorked = useMutation(api.projects.markWorked).withOptimisticUpdate(
    markWorkedOptimistic
  )

  function onMarkWorked() {
    // Fire optimistically: the card stamps "worked just now" and jumps to the
    // top of the dashboard before the server confirms. A quiet toast confirms.
    void markWorked({ projectId: id })
      .then(() => toast(`Marked ${name} as worked on.`))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not update recency."))
      )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label="Mark as worked on"
          data-testid="mark-worked-trigger"
          onClick={onMarkWorked}
          size="icon-sm"
          variant="ghost"
        >
          <Heart />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Mark as worked on</TooltipContent>
    </Tooltip>
  )
}

function ProjectCard({ project }: { project: DashboardProject }) {
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
        href={`/projects/${project._id}`}
        onFocus={() => prefetch(project._id)}
        onMouseEnter={() => prefetch(project._id)}
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
          id={project._id}
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
          <MarkWorkedButton id={project._id} name={project.name} />
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
