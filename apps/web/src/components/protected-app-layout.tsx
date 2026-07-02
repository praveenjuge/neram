"use client"

import type { ReactNode } from "react"

import { AppLayout, Protected } from "@/components/app-shell"

export function ProtectedAppLayout({ children }: { children: ReactNode }) {
  return (
    <Protected>
      <AppLayout>{children}</AppLayout>
    </Protected>
  )
}
