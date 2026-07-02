import { ActivityClient } from "@/app/(app)/activity/activity-client"

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
