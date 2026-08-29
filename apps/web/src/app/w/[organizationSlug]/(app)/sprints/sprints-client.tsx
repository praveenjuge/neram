"use client"

import { CalendarClock, History, MoreHorizontal, Plus } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { DialogTrigger } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TooltipProvider } from "@/components/ui/tooltip"
import { NewTaskDialog } from "@/components/project-board/new-task-dialog"
import { CurrentSprint } from "@/components/sprints/current-sprint"
import { DurationDialog } from "@/components/sprints/duration-dialog"
import { HistorySheet } from "@/components/sprints/history-sheet"

type FocusDialog = "history" | "duration" | null

export function SprintsClient() {
  const [dialog, setDialog] = useState<FocusDialog>(null)

  return (
    <TooltipProvider>
      <section className="mx-auto grid w-full max-w-7xl gap-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-lg font-medium">Focus</h1>
            <p className="text-sm text-muted-foreground">
              The work that matters now.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NewTaskDialog
              trigger={
                <DialogTrigger asChild>
                  <Button>
                    <Plus /> Add task
                  </Button>
                </DialogTrigger>
              }
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="More Focus options"
                  size="icon"
                  variant="ghost"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDialog("history")}>
                  <History /> History
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog("duration")}>
                  <CalendarClock /> Default duration
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <CurrentSprint />
      </section>
      <HistorySheet
        onOpenChange={(open) => !open && setDialog(null)}
        open={dialog === "history"}
      />
      <DurationDialog
        onOpenChange={(open) => !open && setDialog(null)}
        open={dialog === "duration"}
      />
    </TooltipProvider>
  )
}
