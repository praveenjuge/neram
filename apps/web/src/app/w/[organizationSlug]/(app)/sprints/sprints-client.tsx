"use client"

import { CalendarClock, History, MoreHorizontal } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TooltipProvider } from "@/components/ui/tooltip"
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
