import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import { Ban, Copy, RefreshCw, Share2, UserMinus, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { api } from "../../../convex/_generated/api"
import { messageFromError } from "@/lib/errors"
import { Badge } from "@/components/ui/badge"
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
import { Spinner } from "@/components/ui/spinner"

import { type ProjectRefProps, useControlledOpen } from "./shared"

export function ShareProjectDialog({
  id,
  name,
  open: openProp,
  onOpenChange,
  trigger,
}: ProjectRefProps) {
  const ensureInvite = useMutation(api.invites.ensure)
  const regenerateInvite = useMutation(api.invites.regenerate)
  const revokeInvite = useMutation(api.invites.revoke)
  const removeMember = useMutation(api.members.remove)
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange)
  const [token, setToken] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  // Only subscribe to the member list while the dialog is open so the dashboard
  // doesn't hold a members subscription open for every owned card.
  const members = useQuery(api.members.list, open ? { projectId: id } : "skip")

  // Reset link state the moment the dialog opens so stale tokens never show.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setToken(null)
      setWorking(true)
    }
  }

  // ...then ensure an invite link exists, so there's always one to copy.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    ensureInvite({ projectId: id })
      .then((value) => {
        if (!cancelled) setToken(value)
      })
      .catch((error) =>
        toast.error(messageFromError(error, "Could not create the link."))
      )
      .finally(() => {
        if (!cancelled) setWorking(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, id, ensureInvite])

  const link = token ? `${window.location.origin}/join/${token}` : ""

  async function onCopy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success("Link copied.")
    } catch {
      toast.error("Could not copy the link.")
    }
  }

  async function onGenerate() {
    setWorking(true)
    try {
      setToken(await ensureInvite({ projectId: id }))
      toast.success("Sharing turned on.")
    } catch (error) {
      toast.error(messageFromError(error, "Could not create the link."))
    } finally {
      setWorking(false)
    }
  }

  async function onRegenerate() {
    setWorking(true)
    try {
      setToken(await regenerateInvite({ projectId: id }))
      toast.success("New link generated. The old link no longer works.")
    } catch (error) {
      toast.error(messageFromError(error, "Could not regenerate the link."))
    } finally {
      setWorking(false)
    }
  }

  async function onRevoke() {
    setWorking(true)
    try {
      await revokeInvite({ projectId: id })
      setToken(null)
      toast.success("Sharing turned off.")
    } catch (error) {
      toast.error(messageFromError(error, "Could not revoke the link."))
    } finally {
      setWorking(false)
    }
  }

  async function onRemoveMember(subject: string, displayName: string) {
    try {
      await removeMember({ projectId: id, subject })
      toast.success(`Removed ${displayName}.`)
    } catch (error) {
      toast.error(messageFromError(error, "Could not remove the member."))
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share {name}</DialogTitle>
          <DialogDescription>
            Anyone signed in who opens this link can join as an editor. Editors
            add and edit tasks, but can't delete or re-share the project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label>Invite link</Label>
            {token ? (
              <div className="flex gap-2">
                <Input data-testid="invite-link-input" readOnly value={link} />
                <Button
                  aria-label="Copy link"
                  onClick={onCopy}
                  type="button"
                  variant="outline"
                >
                  <Copy />
                </Button>
              </div>
            ) : working ? (
              <div className="flex h-9 items-center">
                <Spinner className="size-4 text-muted-foreground" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sharing is off. Generate a link to invite collaborators.
              </p>
            )}
            <div className="flex gap-2">
              {token ? (
                <>
                  <Button
                    data-testid="regenerate-invite-button"
                    disabled={working}
                    onClick={onRegenerate}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCw /> Regenerate
                  </Button>
                  <Button
                    data-testid="revoke-invite-button"
                    disabled={working}
                    onClick={onRevoke}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Ban /> Revoke
                  </Button>
                </>
              ) : (
                <Button
                  data-testid="generate-invite-button"
                  disabled={working}
                  onClick={onGenerate}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Share2 /> Generate link
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <Users className="size-4" /> Members
            </Label>
            <ul className="grid gap-1">
              {members === undefined ? (
                <li className="px-1 text-sm text-muted-foreground">Loading…</li>
              ) : (
                members.map((member) => (
                  <li
                    className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
                    key={member.subject}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm">
                        {member.displayName}
                        {member.isYou ? " (you)" : ""}
                      </span>
                      <Badge variant="outline">
                        {member.role === "owner" ? "Owner" : "Editor"}
                      </Badge>
                    </span>
                    {member.role === "editor" ? (
                      <Button
                        aria-label={`Remove ${member.displayName}`}
                        data-testid="remove-member-button"
                        onClick={() =>
                          onRemoveMember(member.subject, member.displayName)
                        }
                        size="sm"
                        variant="ghost"
                      >
                        <UserMinus />
                      </Button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
