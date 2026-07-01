import { useMutation } from "convex/react"
import { LogOut } from "lucide-react"
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

export function LeaveProjectDialog({
  id,
  name,
  open: openProp,
  onOpenChange,
  trigger,
}: ProjectRefProps) {
  const leaveProject = useMutation(api.members.leave).withOptimisticUpdate(
    removeProjectOptimistic
  )
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange)

  function onLeave() {
    // Optimistic remove drops the card immediately; close and let it run.
    void leaveProject({ projectId: id })
      .then(() => toast.success(`Left ${name}.`))
      .catch((error) =>
        toast.error(messageFromError(error, "Could not leave the project."))
      )
    setOpen(false)
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave {name}?</DialogTitle>
          <DialogDescription>
            You'll lose access to this board. You can rejoin later if someone
            shares the link with you again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            data-testid="confirm-leave-project-button"
            onClick={onLeave}
            type="button"
            variant="destructive"
          >
            <LogOut /> Leave project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
