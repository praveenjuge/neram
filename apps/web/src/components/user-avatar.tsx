import { cn } from "@/lib/utils"

/** Up to two initials from a display name, used as a compact avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * A small initials avatar for an Organization member. There are no uploaded photos,
 * so we render initials in a muted circle. `title` surfaces the full name on
 * hover; the element is hidden from the accessibility tree since the name is
 * already conveyed by surrounding text.
 */
export function UserAvatar({
  name,
  className,
  title,
}: {
  name: string
  className?: string
  title?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground",
        className
      )}
      title={title ?? name}
    >
      {initials(name)}
    </span>
  )
}
