import { useConvex } from "convex/react"
import { useCallback, useRef } from "react"

import { api } from "@neram/convex/api"
import type { Id } from "@neram/convex/data-model"

// How long a warmed subscription is held open after a hover/focus. Long enough
// to bridge the navigation, short enough to release if the user never clicks.
const PREFETCH_TTL = 15_000

/**
 * Returns a callback that warms the board's Convex queries for a project. Calling
 * it on hover/focus opens short-lived subscriptions to `projects.get` and
 * `tasks.list`, so when the user navigates the board renders from the warm cache
 * instead of showing a skeleton. Route module preloading is already handled by
 * the router's `defaultPreload: "intent"`.
 */
export function useProjectPrefetch() {
  const convex = useConvex()
  const lastPrefetched = useRef(new Map<string, number>())

  return useCallback(
    (projectId: Id<"projects">) => {
      const now = Date.now()
      const previous = lastPrefetched.current.get(projectId)
      if (previous && now - previous < PREFETCH_TTL) return
      lastPrefetched.current.set(projectId, now)

      const unsubscribers = [
        convex.watchQuery(api.projects.get, { projectId }).onUpdate(() => {}),
        convex.watchQuery(api.tasks.list, { projectId }).onUpdate(() => {}),
      ]
      setTimeout(() => {
        for (const unsubscribe of unsubscribers) unsubscribe()
      }, PREFETCH_TTL)
    },
    [convex]
  )
}
