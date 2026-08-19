import type { ReactNode } from "react"
import { Suspense } from "react"

import { AppProviders } from "@/components/app-providers"
import { ProtectedAppLayout } from "@/components/protected-app-layout"

import { DynamicMarker } from "./dynamic-marker"

export const instant = false

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <>
      <Suspense fallback={null}>
        <DynamicMarker />
      </Suspense>
      <AppProviders>
        <ProtectedAppLayout>{children}</ProtectedAppLayout>
      </AppProviders>
    </>
  )
}
