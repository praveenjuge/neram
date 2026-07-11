import { SprintsClient } from "@/app/w/[organizationSlug]/(app)/sprints/sprints-client"

export const metadata = { title: "Sprints" }
export const instant = false

export default function SprintsPage() {
  return <SprintsClient />
}
