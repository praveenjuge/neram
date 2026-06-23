import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { TaskItem } from "@/components/task-item"

import type { Task } from "./board-shared"

export function TaskCard({
  task,
  isDragging,
  onDragStart,
  onDragEnd,
  onHover,
  onOpen,
}: {
  task: Task
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onHover: () => void
  onOpen: () => void
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
          status={task.status}
          title={task.title}
        />
      </CardContent>
    </Card>
  )
}
