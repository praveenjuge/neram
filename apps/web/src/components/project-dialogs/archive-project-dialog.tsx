import { useMutation } from "convex/react"
import { Archive } from "lucide-react"
import { toast } from "sonner"

import { api } from "@neram/convex/api"
import { messageFromError } from "@/lib/errors"
import { archiveProjectOptimistic } from "@/lib/optimistic"
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

export function ArchiveProjectDialog({
  id,
  name,
  open: openProp,
  onOpenChange,
  trigger,
}: ProjectRefProps) {
  const archiveProject = useMutation(api.projects.archive).withOptimisticUpdate(
    archiveProjectOptimistic
  )
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange)

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
          <DialogTitle>Archive {name}?</DialogTitle>
          <DialogDescription>
            This hides the project and its tasks from your dashboard and
            sidebar. You can unarchive or permanently delete it later from the
            Archived page.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            data-testid="confirm-archive-project-button"
            onClick={onArchive}
            type="button"
          >
            <Archive /> Archive project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
