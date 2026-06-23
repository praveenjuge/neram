import { useMutation } from "convex/react"
import { Trash2 } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"

import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { messageFromError } from "@/lib/errors"
import {
  removeProjectOptimistic,
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
  const deleteProject = useMutation(api.projects.remove).withOptimisticUpdate(
    removeProjectOptimistic
  )
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange)
  const [nextName, setNextName] = useState(name)
  const [nextIcon, setNextIcon] = useState<ProjectIconName>(
    (icon as ProjectIconName) ?? DEFAULT_PROJECT_ICON
  )
  const [nextColor, setNextColor] = useState<ProjectColorName>(
    (color as ProjectColorName) ?? DEFAULT_PROJECT_COLOR
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reset the form to the project's current values each time the dialog opens.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setNextName(name)
      setNextIcon((icon as ProjectIconName) ?? DEFAULT_PROJECT_ICON)
      setNextColor((color as ProjectColorName) ?? DEFAULT_PROJECT_COLOR)
      setConfirmDelete(false)
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

  function onDelete() {
    // Optimistic remove drops the card immediately; close and let it run.
    void deleteProject({ projectId: id })
      .then(() => toast.success("Project deleted."))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not delete the project."))
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
            Update the name, icon, and color, or delete this project.
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
          {confirmDelete && role === "owner" ? (
            <div className="grid gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-muted-foreground">
                This permanently deletes the project and all of its tasks.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setConfirmDelete(false)}
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  data-testid="confirm-delete-project-button"
                  onClick={onDelete}
                  type="button"
                  variant="destructive"
                >
                  <Trash2 /> Delete project
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter
            className={cn(role === "owner" && "sm:justify-between")}
          >
            {role === "owner" ? (
              <Button
                className={confirmDelete ? "invisible" : undefined}
                data-testid="delete-project-trigger"
                onClick={() => setConfirmDelete(true)}
                type="button"
                variant="destructive"
              >
                <Trash2 /> Delete
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
