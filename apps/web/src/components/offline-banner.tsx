"use client"

import { useOffline } from "next/offline"

export function OfflineBanner() {
  const isOffline = useOffline()

  if (!isOffline) return null

  return (
    <div
      role="status"
      className="bg-amber-500/15 px-4 py-1.5 text-center text-xs text-amber-900 dark:text-amber-200"
    >
      You&apos;re offline. Navigations and pending requests retry on reconnect.
    </div>
  )
}
