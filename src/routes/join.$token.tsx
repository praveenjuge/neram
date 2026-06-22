import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import { ArrowRight, Link2Off, Users } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { api } from "../../convex/_generated/api"
import { messageFromError } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Protected } from "./-components"

export const Route = createFileRoute("/join/$token")({
  component: JoinPage,
})

function JoinPage() {
  const { token } = Route.useParams()
  return (
    // Send the user back to this invite after signing in, not the dashboard.
    <Protected redirectUrl={`/join/${token}`}>
      <JoinContent token={token} />
    </Protected>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
      {children}
    </main>
  )
}

function JoinContent({ token }: { token: string }) {
  const preview = useQuery(api.invites.preview, { token })
  const acceptInvite = useMutation(api.invites.accept)
  const navigate = useNavigate()
  const [working, setWorking] = useState(false)

  if (preview === undefined) {
    return (
      <Centered>
        <Spinner className="size-6 text-muted-foreground" />
      </Centered>
    )
  }

  if (preview === null) {
    return (
      <Centered>
        <Card className="w-full max-w-md text-center">
          <CardHeader className="items-center">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <Link2Off className="size-5" />
            </span>
            <CardTitle>This link isn't valid</CardTitle>
            <CardDescription>
              It may have been revoked or replaced with a new one. Ask the owner
              for an updated invite link.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild variant="outline">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          </CardFooter>
        </Card>
      </Centered>
    )
  }

  async function onAccept() {
    setWorking(true)
    try {
      const projectId = await acceptInvite({ token })
      navigate({ to: "/projects/$projectId", params: { projectId } })
    } catch (error) {
      toast.error(messageFromError(error, "Could not join the project."))
      setWorking(false)
    }
  }

  return (
    <Centered>
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
            <Users className="size-5" />
          </span>
          <CardTitle>{preview.projectName}</CardTitle>
          <CardDescription>
            {preview.alreadyMember
              ? "You already have access to this project."
              : `Invited by ${preview.ownerName} to collaborate as an editor.`}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center gap-2">
          {preview.alreadyMember ? (
            <Button
              data-testid="open-board-button"
              disabled={working}
              onClick={onAccept}
            >
              Open board <ArrowRight />
            </Button>
          ) : (
            <>
              <Button asChild variant="outline">
                <Link to="/dashboard">Decline</Link>
              </Button>
              <Button
                data-testid="accept-invite-button"
                disabled={working}
                onClick={onAccept}
              >
                {working ? "Joining…" : "Accept invite"}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </Centered>
  )
}
