import { useMutation } from "convex/react"
import { FolderPlus } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import { messageFromError } from "@/lib/errors"
import { createProjectOptimistic } from "@/lib/optimistic"
import {
  getProjectColorLabel,
  type ProjectColorName,
  randomProjectColor,
} from "@/lib/project-colors"
import { type ProjectIconName, randomProjectIcon } from "@/lib/project-icons"
import { ColorPicker } from "@/components/color-picker"
import { IconPicker } from "@/components/icon-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { ProjectPreview } from "./project-preview"
import { type DialogControlProps, useControlledOpen } from "./shared"

export function NewProjectDialog({
  open: openProp,
  onOpenChange,
  trigger,
}: DialogControlProps) {
  const createProject = useMutation(api.projects.create).withOptimisticUpdate(
    createProjectOptimistic
  )
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState<ProjectIconName>(randomProjectIcon)
  const [color, setColor] = useState<ProjectColorName>(randomProjectColor)

  // Seed each new project with a random icon + color for a bit of variety,
  // every time the dialog opens (covers both trigger and programmatic opens).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setName("")
      setIcon(randomProjectIcon())
      setColor(randomProjectColor())
    }
  }

  function shuffleAppearance() {
    setIcon(randomProjectIcon())
    setColor(randomProjectColor())
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      toast.error("Project name is required.")
      return
    }

    // Fire optimistically and close immediately: the card is already in the
    // list. A failure rolls back the optimistic insert and surfaces a toast.
    void createProject({ name: nextName.slice(0, 80), icon, color })
      .then(() => toast.success("Project created."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not create the project."))
      )
    setOpen(false)
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Give your board a name, then pick an icon and color. You can add
            tasks once it is created.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <ProjectPreview
            color={color}
            icon={icon}
            name={name}
            onShuffle={shuffleAppearance}
          />
          <div className="grid gap-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              autoFocus
              data-testid="project-name-input"
              id="project-name"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Website redesign"
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Color</Label>
              <span className="text-xs text-muted-foreground">
                {getProjectColorLabel(color)}
              </span>
            </div>
            <ColorPicker onChange={setColor} value={color} />
          </div>
          <div className="grid gap-2">
            <Label>Icon</Label>
            <IconPicker onChange={setIcon} value={icon} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button data-testid="create-project-button" type="submit">
              <FolderPlus /> Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
