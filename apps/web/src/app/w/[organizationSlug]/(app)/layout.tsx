import type { ReactNode } from "react"

import { ProtectedAppLayout } from "@/components/protected-app-layout"

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode
}) {
  return <ProtectedAppLayout>{children}</ProtectedAppLayout>
}
