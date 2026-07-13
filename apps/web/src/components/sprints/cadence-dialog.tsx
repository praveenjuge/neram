"use client"

import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { CalendarClock } from "lucide-react"
import { useState } from "react"

import { api } from "@neram/convex/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { InfoHint, runToast } from "./shared"

type CadenceSettings = NonNullable<
  FunctionReturnType<typeof api.organizations.current>["settings"]
>

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

export function CadenceDialog() {
  const context = useQuery(api.organizations.current)
  const [open, setOpen] = useState(false)

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <CalendarClock /> Cadence
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            Sprint cadence
            <InfoHint text="Changes apply to Upcoming and future Sprints, never the active Sprint's dates." />
          </DialogTitle>
          <DialogDescription>
            Set how long Sprints run and when they start.
          </DialogDescription>
        </DialogHeader>
        {open && context !== undefined ? (
          <CadenceForm
            onDone={() => setOpen(false)}
            settings={context.settings}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Loading settings…</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CadenceForm({
  settings,
  onDone,
}: {
  settings: CadenceSettings | null
  onDone: () => void
}) {
  const updateCadence = useMutation(api.sprints.updateCadence)
  const [cadenceWeeks, setCadenceWeeks] = useState(
    String(settings?.cadenceWeeks ?? 2)
  )
  const [startWeekday, setStartWeekday] = useState(
    String(settings?.startWeekday ?? 1)
  )
  const [timezone, setTimezone] = useState(
    settings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  )

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="cadence-weeks">Weeks</Label>
          <Input
            id="cadence-weeks"
            max={8}
            min={1}
            onChange={(event) => setCadenceWeeks(event.target.value)}
            type="number"
            value={cadenceWeeks}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="start-weekday">Start day</Label>
          <Select onValueChange={setStartWeekday} value={startWeekday}>
            <SelectTrigger className="w-full" id="start-weekday">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((day, index) => (
                <SelectItem key={day} value={String(index)}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label
            className="flex items-center gap-1.5"
            htmlFor="sprint-timezone"
          >
            Timezone
            <InfoHint text="An IANA timezone name, e.g. Asia/Kolkata or America/New_York." />
          </Label>
          <Input
            id="sprint-timezone"
            onChange={(event) => setTimezone(event.target.value)}
            value={timezone}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() => {
            runToast(
              updateCadence({
                cadenceWeeks: Number(cadenceWeeks),
                startWeekday: Number(startWeekday),
                timezone,
              }),
              {
                success: "Sprint cadence updated.",
                error: "Could not update cadence.",
              }
            )
            onDone()
          }}
        >
          <CalendarClock /> Update cadence
        </Button>
      </DialogFooter>
    </>
  )
}
