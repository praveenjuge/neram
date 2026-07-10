import { DashboardClient } from "@/app/w/[organizationSlug]/(app)/dashboard/dashboard-client"

export const metadata = {
  title: "Dashboard",
}

export const instant = false

export default function DashboardPage() {
  return (
    <main className="contents">
      <DashboardClient />
    </main>
  )
}
