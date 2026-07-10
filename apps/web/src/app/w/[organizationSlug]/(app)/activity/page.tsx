import { ActivityClient } from "@/app/w/[organizationSlug]/(app)/activity/activity-client"

export const metadata = {
  title: "Activity",
}

export const instant = false

export default function ActivityPage() {
  return (
    <main className="contents">
      <ActivityClient />
    </main>
  )
}
