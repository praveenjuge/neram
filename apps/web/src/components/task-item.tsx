import {
  CalendarClock,
  Circle,
  CircleCheck,
  CircleDot,
  type LucideIcon,
} from "lucide-react"

import { formatDueDate } from "@/lib/dates"
import { getProjectColorText } from "@/lib/project-colors"
import { ProjectIcon } from "@/lib/project-icons"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/user-avatar"

export type TaskStatus = "todo" | "inProgress" | "done"

// Single source of truth for how each status reads: the same icon + label is
// reused on the board columns, the Tasks list, and anywhere a task shows.
const statusMeta: Record<TaskStatus, { label: string; icon: LucideIcon }> = {
  todo: { label: "Todo", icon: Circle },
  inProgress: { label: "In Progress", icon: CircleDot },
  done: { label: "Done", icon: CircleCheck },
}

/**
 * A task rendered as a single horizontal line, reused everywhere a task is
 * listed (board cards, Tasks list, etc.). Layout, left to right:
 * status icon → title → due date → project (only when `project` is given,
 * i.e. outside a single-project view) → assignee avatar (only when assigned).
 */
export function TaskItem({
  status,
  title,
  dueDate,
  assigneeName,
  project,
  className,
}: {
  status: TaskStatus
  title: string
  dueDate?: string
  assigneeName?: string | null
  /** Pass to show the project chip when the task isn't already in a project view. */
  project?: { name: string; icon?: string; color?: string }
  className?: string
}) {
  const meta = statusMeta[status]
  const StatusIcon = meta.icon
  return (
    <div className={cn("flex w-full items-center gap-2.5", className)}>
      <StatusIcon
        aria-label={meta.label}
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {title}
      </span>
      {dueDate ? (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" />
          {formatDueDate(dueDate)}
        </span>
      ) : null}
      {project ? (
        <span className="flex min-w-0 shrink items-center gap-1.5 text-xs text-muted-foreground">
          <ProjectIcon
            className={cn(
              "size-3.5 shrink-0",
              getProjectColorText(project.color)
            )}
            name={project.icon}
          />
          <span className="max-w-32 truncate">{project.name}</span>
        </span>
      ) : null}
      {assigneeName ? (
        <UserAvatar
          className="size-5"
          name={assigneeName}
          title={`Assigned to ${assigneeName}`}
        />
      ) : null}
    </div>
  )
}
