import { cn } from "@/lib/utils"
import { ListChecks, MessageSquare } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { TaskItem } from "@/components/task-item"

import type { BoardTask } from "./board-shared"

export function TaskCard({
  task,
  isDragging,
  onDragStart,
  onDragEnd,
  onHover,
  onOpen,
  showProject = false,
}: {
  task: BoardTask
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onHover: () => void
  onOpen: () => void
  /** Show the project chip (used on the cross-project Tasks board). */
  showProject?: boolean
}) {
  return (
    <Card
      aria-label={`Open ${task.title}`}
      className={cn(
        "cursor-grab gap-2 transition-opacity outline-none focus-visible:ring-3 focus-visible:ring-ring/30 active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
      data-testid="task-card"
      draggable
      onClick={onOpen}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
        onHover()
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", task._id)
        onDragStart()
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
      role="button"
      size="sm"
      tabIndex={0}
    >
      <CardContent>
        <TaskItem
          assigneeName={task.assigneeName}
          dueDate={task.dueDate}
          project={
            showProject && task.projectName
              ? {
                  name: task.projectName,
                  icon: task.projectIcon,
                  color: task.projectColor,
                }
              : undefined
          }
          status={task.status}
          title={task.title}
        />
        {task.totalSubtasks > 0 || task.activeCommentCount > 0 ? (
          <div className="mt-2 flex items-center gap-3 pl-6 text-xs text-muted-foreground">
            {task.totalSubtasks > 0 ? (
              <span className="flex items-center gap-1">
                <ListChecks className="size-3.5" />
                {task.completedSubtasks}/{task.totalSubtasks}
              </span>
            ) : null}
            {task.activeCommentCount > 0 ? (
              <span className="flex items-center gap-1">
                <MessageSquare className="size-3.5" />
                {task.activeCommentCount}
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
