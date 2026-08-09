import { useAction } from "convex/react"
import { Share2 } from "lucide-react"
import type { FormEvent, ReactNode } from "react"
import { useState } from "react"
import { toast } from "sonner"

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
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { messageFromError } from "@/lib/errors"

export function ShareProjectsDialog({ trigger }: { trigger: ReactNode }) {
  const invite = useAction(api.organizationActions.invite)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [working, setWorking] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextEmail = email.trim()
    if (!nextEmail) return

    setWorking(true)
    try {
      await invite({ email: nextEmail, role: "org:member" })
      toast.success(`Invitation sent to ${nextEmail}.`)
      setEmail("")
      setOpen(false)
    } catch (error) {
      toast.error(messageFromError(error, "Could not send the invitation."))
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share projects</DialogTitle>
          <DialogDescription>
            Invite someone to this workspace. They can view and work on every
            project.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="share-projects-email">Email address</Label>
            <Input
              autoComplete="email"
              autoFocus
              id="share-projects-email"
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
              type="email"
              value={email}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={working || !email.trim()} type="submit">
              <Share2 /> {working ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
