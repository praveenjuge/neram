"use client"

import { useOffline } from "next/offline"

import { Spinner } from "@/components/ui/spinner"

export function OfflineAwareLoading({ label = "Loading" }: { label?: string }) {
  const isOffline = useOffline()

  return (
    <div className="grid flex-1 place-items-center gap-2 p-6 text-center">
      <Spinner className="size-6 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">
        {isOffline ? "Waiting for connection…" : label}
      </p>
    </div>
  )
}
