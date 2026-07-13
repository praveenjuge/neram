"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { BacklogPicker } from "@/components/sprints/backlog-picker"
import { CadenceDialog } from "@/components/sprints/cadence-dialog"
import { CurrentSprint } from "@/components/sprints/current-sprint"
import { HistorySheet } from "@/components/sprints/history-sheet"
import { UpcomingSprint } from "@/components/sprints/upcoming-sprint"

type SprintTab = "current" | "backlog" | "upcoming"

const tabs: Array<{ id: SprintTab; label: string }> = [
  { id: "current", label: "Current" },
  { id: "backlog", label: "Backlog" },
  { id: "upcoming", label: "Upcoming" },
]

export function SprintsClient() {
  const [tab, setTab] = useState<SprintTab>("current")
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
                  onClick={() => setTab(item.id)}
                  size="sm"
                  variant={tab === item.id ? "default" : "ghost"}
                >
                  {item.label}
                </Button>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <HistorySheet />
            <CadenceDialog />
          </div>
        </div>
        {tab === "current" ? <CurrentSprint /> : null}
        {tab === "backlog" ? <BacklogPicker /> : null}
        {tab === "upcoming" ? <UpcomingSprint /> : null}
      </section>
    </TooltipProvider>
  )
}
