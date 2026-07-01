import { useMutation } from "convex/react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import { messageFromError } from "@/lib/errors"
import { removeProjectOptimistic } from "@/lib/optimistic"
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

import { type ProjectRefProps, useControlledOpen } from "./shared"

export function DeleteProjectDialog({
  id,
  name,
  open: openProp,
  onOpenChange,
  trigger,
}: ProjectRefProps) {
  const deleteProject = useMutation(api.projects.remove).withOptimisticUpdate(
    removeProjectOptimistic
  )
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange)

  function onDelete() {
    // Optimistic remove drops the project immediately; close and let it run.
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
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>
            This permanently deletes the project and all of its tasks. This
            can't be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            data-testid="confirm-delete-project-button"
            onClick={onDelete}
            type="button"
            variant="destructive"
          >
            <Trash2 /> Delete project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
