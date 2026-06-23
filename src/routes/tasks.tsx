import { useQuery } from "convex-helpers/react/cache"
import type { FunctionReturnType } from "convex/server"
import {
  CalendarClock,
  Circle,
  CircleCheck,
  CircleDot,
  ListTodo,
  type LucideIcon,
} from "lucide-react"

import { Link, createFileRoute } from "@tanstack/react-router"
import { api } from "../../convex/_generated/api"
import { formatDueDate } from "@/lib/dates"
import { useProjectPrefetch } from "@/lib/prefetch"
import { getProjectColorText } from "@/lib/project-colors"
import { ProjectIcon } from "@/lib/project-icons"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { AppLayout, Protected } from "./-components"

export const Route = createFileRoute("/tasks")({
  component: () => (
    <Protected>
      <MyTasks />
    </Protected>
  ),
})

type Task = FunctionReturnType<typeof api.tasks.listAll>[number]
type Status = Task["status"]

// Each status maps to the same icon + label used on the project board, so the
// list reads consistently with the kanban columns.
const statusMeta: Record<Status, { label: string; icon: LucideIcon }> = {
  todo: { label: "Todo", icon: Circle },
  inProgress: { label: "In Progress", icon: CircleDot },
  done: { label: "Done", icon: CircleCheck },
}

function MyTasks() {
  const tasks = useQuery(api.tasks.listAll)

  return (
    <AppLayout>
      <section className="mx-auto grid w-full max-w-3xl gap-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-lg font-medium">My Tasks</h1>
          {tasks && tasks.length > 0 ? (
            <Badge variant="secondary">{tasks.length}</Badge>
          ) : null}
        </div>
        {tasks === undefined ? (
          <div className="grid min-h-[40vh] place-items-center">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-2">
            {tasks.map((task) => (
              <li key={task._id}>
                <TaskRow task={task} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppLayout>
  )
}

function TaskRow({ task }: { task: Task }) {
  const prefetch = useProjectPrefetch()
  const meta = statusMeta[task.status]
  const StatusIcon = meta.icon
  return (
    <Card size="sm">
      <Link
        className="block"
        data-testid="my-task-row"
        onFocus={() => prefetch(task.projectId)}
        onMouseEnter={() => prefetch(task.projectId)}
        params={{ projectId: task.projectId }}
        to="/projects/$projectId"
      >
        <CardContent className="flex w-full items-start gap-3">
          <StatusIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium">{task.title}</p>
            {task.description ? (
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {task.description}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ProjectIcon
                  className={cn(
                    "size-3.5 shrink-0",
                    getProjectColorText(task.projectColor)
                  )}
                  name={task.projectIcon}
                />
                <span className="truncate">{task.projectName}</span>
              </span>
              <span>{meta.label}</span>
              {task.dueDate ? (
                <span className="flex items-center gap-1">
                  <CalendarClock className="size-3.5" />
                  Due {formatDueDate(task.dueDate)}
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}

function EmptyState() {
  return (
    <Card className="items-center justify-center gap-3 border border-dashed py-12 text-center shadow-none ring-0">
      <CardContent className="flex flex-col items-center gap-3">
        <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <ListTodo className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">No tasks yet</p>
          <p className="text-sm text-muted-foreground">
            Tasks from all your projects will show up here.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
