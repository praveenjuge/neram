function Pulse({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-muted ${className}`}
    />
  )
}

export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading projects"
      className="grid gap-0 divide-y divide-border rounded-lg border"
    >
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex items-center gap-3 px-4 py-3">
          <Pulse className="size-4 shrink-0" />
          <Pulse className="h-4 min-w-0 flex-1" />
          <Pulse className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function BoardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading board"
      className="grid gap-4 md:grid-cols-3"
    >
      {[0, 1, 2].map((col) => (
        <div key={col} className="grid gap-2 rounded-lg border p-3">
          <Pulse className="h-4 w-20" />
          <Pulse className="h-16 w-full" />
          <Pulse className="h-16 w-full" />
        </div>
      ))}
    </div>
  )
}

export function ActivitySkeleton() {
  return (
    <div role="status" aria-label="Loading activity" className="grid gap-2">
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="flex items-start gap-3 px-2 py-3">
          <Pulse className="size-8 shrink-0 rounded-full" />
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Pulse className="h-3.5 w-2/3" />
            <Pulse className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
