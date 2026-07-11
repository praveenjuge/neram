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
import {
  findOrganizationBySlug,
  membershipLookupState,
} from "@/lib/sprint-planning"

function LoadingWorkspace() {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <Spinner className="size-6 text-muted-foreground" />
    </main>
  )
}

function WorkspaceError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <main className="grid min-h-svh place-items-center p-6 text-center">
      <div className="grid max-w-sm gap-3">
        <p className="font-medium">Workspace unavailable</p>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button onClick={onRetry} variant="outline">
          Try again
        </Button>
      </div>
    </main>
  )
}

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const params = useParams()
  const slug =
    typeof params.organizationSlug === "string" ? params.organizationSlug : ""
  const { isLoaded: organizationLoaded, organization } = useOrganization()
  const {
    isLoaded: listLoaded,
    setActive,
    userMemberships,
  } = useOrganizationList({
    userMemberships: { infinite: true, pageSize: 100 },
  })
  const syncCurrent = useAction(api.organizationActions.syncCurrent)
  const [syncedId, setSyncedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const {
    data: memberships,
    fetchNext,
    hasNextPage,
    isError: membershipsError,
    isFetching: membershipsFetching,
    revalidate: revalidateMemberships,
  } = userMemberships

  const matchingMembership = findOrganizationBySlug(memberships, slug)
  const membershipState = membershipLookupState({
    listLoaded,
    hasMatch: Boolean(matchingMembership),
    hasNextPage,
    isFetching: membershipsFetching,
    isError: membershipsError,
  })

  useEffect(() => {
    if (membershipState !== "fetch-next" || !fetchNext) return
    fetchNext()
  }, [fetchNext, membershipState])

  useEffect(() => {
    if (
      !listLoaded ||
      !setActive ||
      !matchingMembership ||
      organization?.slug === slug
    )
      return
    void setActive({ organization: matchingMembership.organization.id })
  }, [listLoaded, matchingMembership, organization?.slug, setActive, slug])

  useEffect(() => {
    if (
      !organizationLoaded ||
      organization?.slug !== slug ||
      syncedId === organization.id
    )
      return
    let active = true
    void syncCurrent({})
      .then(() => {
        if (active) setSyncedId(organization.id)
      })
      .catch((reason) => {
        if (active)
          setError(messageFromError(reason, "Could not load this workspace."))
      })
    return () => {
      active = false
    }
  }, [attempt, organization, organizationLoaded, slug, syncCurrent, syncedId])

  if (
    !organizationLoaded ||
    membershipState === "loading" ||
    membershipState === "fetch-next"
  )
    return <LoadingWorkspace />
  if (membershipState === "error") {
    return (
      <WorkspaceError
        message="Could not load your workspace memberships."
        onRetry={() => void revalidateMemberships?.()}
      />
    )
  }
  if (membershipState === "missing") {
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
        <WorkspaceError
          message={error}
          onRetry={() => {
            setError(null)
            setAttempt((current) => current + 1)
          }}
        />
      )
    }
    return <LoadingWorkspace />
  }
  return children
}
