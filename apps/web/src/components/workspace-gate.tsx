"use client"

import {
  OrganizationList,
  useOrganization,
  useOrganizationList,
} from "@clerk/nextjs"
import { useAction } from "convex/react"
import { useParams } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"

import { api } from "@neram/convex/api"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { messageFromError } from "@/lib/errors"

function LoadingWorkspace() {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <Spinner className="size-6 text-muted-foreground" />
    </main>
  )
}

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const params = useParams()
  const slug = typeof params.organizationSlug === "string" ? params.organizationSlug : ""
  const { isLoaded: organizationLoaded, organization } = useOrganization()
  const { isLoaded: listLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true, pageSize: 100 },
  })
  const syncCurrent = useAction(api.organizationActions.syncCurrent)
  const [syncedId, setSyncedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const matchingMembership = userMemberships.data?.find(
    (membership) => membership.organization.slug === slug
  )

  useEffect(() => {
    if (!listLoaded || !setActive || !matchingMembership || organization?.slug === slug) return
    void setActive({ organization: matchingMembership.organization.id })
  }, [listLoaded, matchingMembership, organization?.slug, setActive, slug])

  useEffect(() => {
    if (!organizationLoaded || organization?.slug !== slug || syncedId === organization.id) return
    let active = true
    void syncCurrent({})
      .then(() => {
        if (active) setSyncedId(organization.id)
      })
      .catch((reason) => {
        if (active) setError(messageFromError(reason, "Could not load this workspace."))
      })
    return () => {
      active = false
    }
  }, [attempt, organization, organizationLoaded, slug, syncCurrent, syncedId])

  if (!organizationLoaded || !listLoaded) return <LoadingWorkspace />
  if (!matchingMembership) {
    return (
      <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
        <OrganizationList
          afterCreateOrganizationUrl="/w/:slug/dashboard"
          afterSelectOrganizationUrl="/w/:slug/dashboard"
          hidePersonal
        />
      </main>
    )
  }
  if (organization?.slug !== slug || syncedId !== organization.id) {
    if (error) {
      return (
        <main className="grid min-h-svh place-items-center p-6 text-center">
          <div className="grid max-w-sm gap-3">
            <p className="font-medium">Workspace unavailable</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              onClick={() => {
                setError(null)
                setAttempt((current) => current + 1)
              }}
              variant="outline"
            >
              Try again
            </Button>
          </div>
        </main>
      )
    }
    return <LoadingWorkspace />
  }
  return children
}
