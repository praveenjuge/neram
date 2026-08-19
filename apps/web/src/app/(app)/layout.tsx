import type { ReactNode } from "react"
import { AppProviders } from "@/app/(app)/providers"

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>
}
