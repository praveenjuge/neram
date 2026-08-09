"use client"

import {
  ArrowLeft,
  CalendarClock,
  History,
  ListPlus,
  MoreHorizontal,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TooltipProvider } from "@/components/ui/tooltip"
import { BacklogPicker } from "@/components/sprints/backlog-picker"
import { CadenceDialog } from "@/components/sprints/cadence-dialog"
import { CurrentSprint } from "@/components/sprints/current-sprint"
import { HistorySheet } from "@/components/sprints/history-sheet"
import { UpcomingSprint } from "@/components/sprints/upcoming-sprint"

type SprintView = "current" | "plan" | "upcoming"
type SprintDialog = "history" | "cadence" | null

const tabs: Array<{ id: Exclude<SprintView, "plan">; label: string }> = [
  { id: "current", label: "Current" },
  { id: "upcoming", label: "Upcoming" },
]

export function SprintsClient() {
  const [view, setView] = useState<SprintView>("current")
  const [dialog, setDialog] = useState<SprintDialog>(null)

  return (
    <TooltipProvider>
      <section className="mx-auto grid w-full max-w-7xl gap-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-lg font-medium">Sprints</h1>
            <nav aria-label="Sprint views" className="flex flex-wrap gap-1">
              {tabs.map((item) => (
                <Button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  size="sm"
                  variant={view === item.id ? "secondary" : "ghost"}
                >
                  {item.label}
                </Button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            {view === "plan" ? (
              <Button onClick={() => setView("current")} variant="outline">
                <ArrowLeft /> Back to Current
              </Button>
            ) : (
              <Button onClick={() => setView("plan")}>
                <ListPlus /> Plan Sprint
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="More Sprint options"
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
                <DropdownMenuItem onSelect={() => setDialog("cadence")}>
                  <CalendarClock /> Cadence
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {view === "current" ? <CurrentSprint /> : null}
        {view === "plan" ? <BacklogPicker /> : null}
        {view === "upcoming" ? <UpcomingSprint /> : null}
      </section>
      <HistorySheet
        onOpenChange={(open) => !open && setDialog(null)}
        open={dialog === "history"}
      />
      <CadenceDialog
        onOpenChange={(open) => !open && setDialog(null)}
        open={dialog === "cadence"}
      />
    </TooltipProvider>
  )
}
