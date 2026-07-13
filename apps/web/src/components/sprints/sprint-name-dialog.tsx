"use client"

import type { ReactNode } from "react"
import { useState } from "react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Shared modal for naming a Sprint — used to create a new Sprint (name
 * prefilled with the next default) and to rename an existing one. The name is
 * seeded from `defaultName` each time the dialog opens so the input always
 * reflects the current suggestion.
 */
export function SprintNameDialog({
  title,
  description,
  defaultName,
  submitLabel,
  onSubmit,
  trigger,
}: {
  title: string
  description: string
  defaultName: string
  submitLabel: string
  onSubmit: (name: string) => void
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName)

  function submit() {
    onSubmit(name.trim() || defaultName)
    setOpen(false)
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setName(defaultName)
      }}
      open={open}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="sprint-name">Name</Label>
          <Input
            autoFocus
            id="sprint-name"
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                submit()
              }
            }}
            placeholder={defaultName}
            value={name}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit}>{submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
