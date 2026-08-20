import { SprintsClient } from "@/app/w/[organizationSlug]/(app)/sprints/sprints-client"

export const metadata = { title: "Focus" }
export const instant = false

export default function SprintsPage() {
  return <SprintsClient />
}
