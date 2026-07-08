import { useMutation } from "convex/react"
import { Archive } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"
import { messageFromError } from "@/lib/errors"
import {
  archiveProjectOptimistic,
  updateProjectOptimistic,
} from "@/lib/optimistic"
import {
  DEFAULT_PROJECT_COLOR,
  getProjectColorLabel,
  type ProjectColorName,
  randomProjectColor,
} from "@/lib/project-colors"
import {
  DEFAULT_PROJECT_ICON,
  type ProjectIconName,
  randomProjectIcon,
} from "@/lib/project-icons"
import { cn } from "@/lib/utils"
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

type EditProjectDialogProps = DialogControlProps & {
  id: Id<"projects">
  name: string
  icon?: string
  color?: string
  role: "owner" | "editor"
}

export function EditProjectDialog({
  id,
  name,
  icon,
  color,
  role,
  open: openProp,
  onOpenChange,
  trigger,
}: EditProjectDialogProps) {
  const updateProject = useMutation(api.projects.update).withOptimisticUpdate(
    updateProjectOptimistic
  )
  const archiveProject = useMutation(api.projects.archive).withOptimisticUpdate(
    archiveProjectOptimistic
  )
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange)
  const [nextName, setNextName] = useState(name)
  const [nextIcon, setNextIcon] = useState<ProjectIconName>(
    (icon as ProjectIconName) ?? DEFAULT_PROJECT_ICON
  )
  const [nextColor, setNextColor] = useState<ProjectColorName>(
    (color as ProjectColorName) ?? DEFAULT_PROJECT_COLOR
  )
  const [confirmArchive, setConfirmArchive] = useState(false)

  // Reset the form to the project's current values each time the dialog opens.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setNextName(name)
      setNextIcon((icon as ProjectIconName) ?? DEFAULT_PROJECT_ICON)
      setNextColor((color as ProjectColorName) ?? DEFAULT_PROJECT_COLOR)
      setConfirmArchive(false)
    }
  }

  function shuffleAppearance() {
    setNextIcon(randomProjectIcon())
    setNextColor(randomProjectColor())
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = nextName.trim()
    if (!trimmed) {
      toast.error("Project name is required.")
      return
    }

    // Optimistic edit renders instantly, so close right away.
    void updateProject({
      projectId: id,
      name: trimmed.slice(0, 80),
      icon: nextIcon,
      color: nextColor,
    })
      .then(() => toast.success("Project updated."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not update the project."))
      )
    setOpen(false)
  }

  function onArchive() {
    // Optimistic archive moves the card out immediately; close and let it run.
    void archiveProject({ projectId: id })
      .then(() => toast.success(`Archived ${name}.`))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not archive the project."))
      )
    setOpen(false)
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            Update the name, icon, and color, or archive this project.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <ProjectPreview
            color={nextColor}
            icon={nextIcon}
            name={nextName}
            onShuffle={shuffleAppearance}
          />
          <div className="grid gap-2">
            <Label htmlFor={`edit-project-name-${id}`}>Project name</Label>
            <Input
              autoFocus
              data-testid="edit-project-name-input"
              id={`edit-project-name-${id}`}
              maxLength={80}
              onChange={(event) => setNextName(event.target.value)}
              placeholder="e.g. Website redesign"
              value={nextName}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Color</Label>
              <span className="text-xs text-muted-foreground">
                {getProjectColorLabel(nextColor)}
              </span>
            </div>
            <ColorPicker onChange={setNextColor} value={nextColor} />
          </div>
          <div className="grid gap-2">
            <Label>Icon</Label>
            <IconPicker onChange={setNextIcon} value={nextIcon} />
          </div>
          {confirmArchive && role === "owner" ? (
            <div className="grid gap-3 rounded-2xl border border-border bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">
                This hides the project from your dashboard and sidebar. You can
                unarchive or permanently delete it later from the Archived page.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setConfirmArchive(false)}
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  data-testid="confirm-archive-project-button"
                  onClick={onArchive}
                  type="button"
                >
                  <Archive /> Archive project
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter
            className={cn(role === "owner" && "sm:justify-between")}
          >
            {role === "owner" ? (
              <Button
                className={confirmArchive ? "invisible" : undefined}
                data-testid="archive-project-trigger"
                onClick={() => setConfirmArchive(true)}
                type="button"
                variant="outline"
              >
                <Archive /> Archive
              </Button>
            ) : null}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button data-testid="save-project-button" type="submit">
                Save changes
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
