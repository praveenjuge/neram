import { useQuery } from "convex-helpers/react/cache"
import type { FunctionReturnType } from "convex/server"
import { ListTodo } from "lucide-react"

import { Link, createFileRoute } from "@tanstack/react-router"
import { api } from "@neram/convex/api"
import { useProjectPrefetch } from "@/lib/prefetch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { TaskItem } from "@/components/task-item"
import { AppLayout, Protected } from "./-components"

export const Route = createFileRoute("/tasks")({
  component: () => (
    <Protected>
      <MyTasks />
    </Protected>
  ),
})

type Task = FunctionReturnType<typeof api.tasks.listAll>[number]

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
        <CardContent>
          <TaskItem
            assigneeName={task.assigneeName}
            dueDate={task.dueDate}
            project={{
              name: task.projectName,
              icon: task.projectIcon,
              color: task.projectColor,
            }}
            status={task.status}
            title={task.title}
          />
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
          <p className="font-medium">Nothing assigned to you</p>
          <p className="text-sm text-muted-foreground">
            Tasks assigned to you across your projects will show up here.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
