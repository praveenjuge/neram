"use client"

import { Fragment, useState } from "react"

import type { Id } from "@neram/convex/data-model"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

import {
  columns,
  DropIndicator,
  type BoardTask,
  type Status,
} from "./board-shared"
import { TaskCard } from "./task-card"

export function KanbanBoard({
  tasks,
  onDrop,
  onOpenTask,
  showProject = false,
}: {
  tasks: BoardTask[]
  onDrop: (
    taskId: Id<"tasks">,
    status: Status,
    insertIndex: number
  ) => void | Promise<void>
  onOpenTask: (taskId: Id<"tasks">) => void
  /** Show each card's project chip (cross-project Tasks board). */
  showProject?: boolean
}) {
  const [draggingId, setDraggingId] = useState<Id<"tasks"> | null>(null)
  const [overColumn, setOverColumn] = useState<Status | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {columns.map((column) => {
        const columnTasks = tasks
          .filter((task) => task.status === column.key)
          .sort((a, b) => a.position - b.position)
        const isOver = overColumn === column.key
        return (
          <section
            aria-label={`${column.label} column`}
            className={cn(
              "flex min-h-72 flex-col gap-3 rounded-[min(var(--radius-4xl),24px)] bg-muted/40 p-3 transition-colors",
              isOver && "bg-muted ring-2 ring-primary/40"
            )}
            data-testid={`column-${column.key}`}
            key={column.key}
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null
                )
              ) {
                setOverColumn((current) =>
                  current === column.key ? null : current
                )
                setOverIndex(null)
              }
            }}
            onDragOver={(event) => {
              if (!draggingId) return
              event.preventDefault()
              event.dataTransfer.dropEffect = "move"
              if (overColumn !== column.key) setOverColumn(column.key)
            }}
            onDrop={(event) => {
              event.preventDefault()
              const taskId = event.dataTransfer.getData(
                "text/plain"
              ) as Id<"tasks">
              const insertIndex =
                overColumn === column.key && overIndex !== null
                  ? overIndex
                  : columnTasks.length
              setOverColumn(null)
              setOverIndex(null)
              setDraggingId(null)
              if (taskId) void onDrop(taskId, column.key, insertIndex)
            }}
          >
            <div className="flex items-center justify-between px-1">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <column.icon className="size-4 text-muted-foreground" />
                {column.label}
              </h2>
              <Badge variant="secondary">{columnTasks.length}</Badge>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {columnTasks.map((task, index) => (
                <Fragment key={task._id}>
                  {isOver && overIndex === index ? <DropIndicator /> : null}
                  <TaskCard
                    isDragging={draggingId === task._id}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setOverColumn(null)
                      setOverIndex(null)
                    }}
                    onDragStart={() => setDraggingId(task._id)}
                    onHover={() => {
                      setOverColumn(column.key)
                      setOverIndex(index)
                    }}
                    onOpen={() => onOpenTask(task._id)}
                    showProject={showProject}
                    task={task}
                  />
                </Fragment>
              ))}
              {isOver && overIndex === columnTasks.length ? (
                <DropIndicator />
              ) : null}
              {columnTasks.length === 0 ? (
                <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  Nothing here yet.
                </p>
              ) : null}
              <div
                aria-hidden
                className="min-h-8 flex-1"
                onDragOver={(event) => {
                  if (!draggingId) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"
                  setOverColumn(column.key)
                  setOverIndex(columnTasks.length)
                }}
              />
            </div>
          </section>
        )
      })}
    </div>
  )
}
