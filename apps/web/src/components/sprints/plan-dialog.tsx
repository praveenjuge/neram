"use client"

import { useQuery } from "convex/react"
import { ArrowRight } from "lucide-react"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { dateRange, sprintLabel, type SprintTarget } from "./shared"

/**
 * Modal that picks where selected Backlog work should land: the active Sprint
 * or any scheduled future Sprint. Keeps the Backlog list itself uncluttered —
 * a single action opens the picker instead of one button per destination.
 */
export function PlanTargetDialog({
  count,
  onConfirm,
  trigger,
}: {
  count: number
  onConfirm: (target: SprintTarget) => void
  trigger: ReactNode
}) {
  const current = useQuery(api.sprints.current)
  const upcoming = useQuery(api.sprints.upcomingList)
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<string | undefined>(undefined)

  const options = useMemo(() => {
    const rows: Array<{ value: string; label: string }> = []
    if (current) {
      rows.push({
        value: "current",
        label: `Current · ${sprintLabel(current.sprint)}`,
      })
    }
    for (const { sprint } of upcoming ?? []) {
      rows.push({
        value: sprint._id,
        label: `${sprintLabel(sprint)} · ${dateRange(sprint.startsAt, sprint.endsAt)}`,
      })
    }
    return rows
  }, [current, upcoming])

  // Fall back to the first loaded option so a selection is only ever a real
  // target — never a stale "current" before queries load or in a workspace
  // with no Sprints yet.
  const selected =
    target && options.some((option) => option.value === target)
      ? target
      : options[0]?.value
  const label = count === 1 ? "1 task" : `${count} tasks`

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plan {label}</DialogTitle>
          <DialogDescription>
            Choose the Sprint this work should land in.
          </DialogDescription>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Sprints yet. Create one from the Current or Upcoming tab first.
          </p>
        ) : (
          <Select onValueChange={setTarget} value={selected ?? ""}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a Sprint" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!selected}
            onClick={() => {
              if (!selected) return
              onConfirm(
                selected === "current" ? "current" : (selected as Id<"sprints">)
              )
              setOpen(false)
            }}
          >
            Plan {label} <ArrowRight />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
