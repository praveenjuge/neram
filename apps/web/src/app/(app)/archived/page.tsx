import { ArchivedClient } from "@/app/(app)/archived/archived-client"

export const metadata = {
  title: "Archived",
}

export const instant = false

export default function ArchivedPage() {
  return (
    <main className="contents">
      <ArchivedClient />
    </main>
  )
}
