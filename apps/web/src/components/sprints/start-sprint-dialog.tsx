"use client"

import { useMutation, useQuery } from "convex/react"
import { Play } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"

import { api } from "@neram/convex/api"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import type { SprintDuration } from "./duration-dialog"
import { runToast } from "./shared"

export function StartSprintDialog({ trigger }: { trigger: ReactNode }) {
  const context = useQuery(api.organizations.current)
  const start = useMutation(api.sprints.start)
  const [open, setOpen] = useState(false)
  const [goal, setGoal] = useState("")
  const [duration, setDuration] = useState<SprintDuration>("2")

  function setDialogOpen(next: boolean) {
    setOpen(next)
    if (next) {
      setGoal("")
      setDuration(
        String(context?.settings?.sprintDuration ?? 2) as SprintDuration
      )
    }
  }

  return (
    <Dialog onOpenChange={setDialogOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a Sprint</DialogTitle>
          <DialogDescription>
            Begin with an empty focus list, then choose work from Backlog.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="new-sprint-goal">Goal (optional)</Label>
            <Textarea
              autoFocus
              id="new-sprint-goal"
              maxLength={500}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="What outcome matters most?"
              value={goal}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-sprint-duration">Duration</Label>
            <Select
              onValueChange={(next) => setDuration(next as SprintDuration)}
              value={duration}
            >
              <SelectTrigger className="w-full" id="new-sprint-duration">
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
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => {
              runToast(
                start({
                  goal: goal.trim() || undefined,
                  duration:
                    duration === "open"
                      ? "open"
                      : (Number(duration) as 1 | 2 | 4),
                }),
                {
                  success: "Sprint started.",
                  error: "Could not start the Sprint.",
                }
              )
              setOpen(false)
            }}
          >
            <Play /> Start Sprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
