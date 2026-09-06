import { OfflineAwareLoading } from "@/components/offline-aware-loading"

export default function WorkspaceLoading() {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <OfflineAwareLoading label="Loading workspace…" />
    </main>
  )
}
