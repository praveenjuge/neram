"use client"

import { useMutation, useQuery } from "convex/react"
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
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { runToast } from "./shared"

export type SprintDuration = "1" | "2" | "4" | "open"

export function DurationDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const context = useQuery(api.organizations.current)
  const initial = String(context?.settings?.sprintDuration ?? 2) as SprintDuration

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Default Sprint duration</DialogTitle>
          <DialogDescription>
            Applied when the next Sprint starts. The active Sprint does not change.
          </DialogDescription>
        </DialogHeader>
        {context === undefined ? (
          <p className="text-sm text-muted-foreground">Loading settings…</p>
        ) : (
          <DurationForm
            initial={initial}
            key={initial}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DurationForm({
  initial,
  onDone,
}: {
  initial: SprintDuration
  onDone: () => void
}) {
  const updateDuration = useMutation(api.sprints.updateDuration)
  const [value, setValue] = useState<SprintDuration>(initial)

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="sprint-duration">Duration</Label>
        <Select
          onValueChange={(next) => setValue(next as SprintDuration)}
          value={value}
        >
          <SelectTrigger className="w-full" id="sprint-duration">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 week</SelectItem>
            <SelectItem value="2">2 weeks</SelectItem>
            <SelectItem value="4">4 weeks</SelectItem>
            <SelectItem value="open">No fixed end date</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button
          onClick={() => {
            runToast(
              updateDuration({
                duration: value === "open" ? "open" : Number(value) as 1 | 2 | 4,
              }),
              {
                success: "Default duration updated.",
                error: "Could not update the duration.",
              }
            )
            onDone()
          }}
        >
          <CalendarClock /> Save duration
        </Button>
      </DialogFooter>
    </>
  )
}
