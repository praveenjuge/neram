"use client"

import type { ReactNode } from "react"

import { AppLayout, Protected } from "@/components/app-shell"
import { WorkspaceGate } from "@/components/workspace-gate"

export function ProtectedAppLayout({ children }: { children: ReactNode }) {
  return (
    <Protected>
      <WorkspaceGate>
        <AppLayout>{children}</AppLayout>
      </WorkspaceGate>
    </Protected>
  )
}
