import { Search } from "lucide-react"
import { useMemo, useState } from "react"

import {
  getProjectIconLabel,
  PROJECT_ICON_NAMES,
  ProjectIcon,
  type ProjectIconName,
} from "@/lib/project-icons"
import { cn } from "@/lib/utils"

type IconPickerProps = {
  value: ProjectIconName
  onChange: (icon: ProjectIconName) => void
  disabled?: boolean
}

export function IconPicker({ value, onChange, disabled }: IconPickerProps) {
  const [query, setQuery] = useState("")

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return PROJECT_ICON_NAMES
    return PROJECT_ICON_NAMES.filter((name) =>
      getProjectIconLabel(name).includes(q)
    )
  }, [query])

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          aria-label="Search icons"
          className="h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 py-1 ps-8 pe-2.5 text-sm transition-[color,box-shadow] duration-200 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons"
          type="text"
          value={query}
        />
      </div>
      {matches.length > 0 ? (
        <div
          aria-label="Project icon"
          className="grid max-h-44 grid-cols-7 gap-1.5 overflow-y-auto rounded-2xl border border-border bg-muted/30 p-2 sm:grid-cols-9"
          role="radiogroup"
        >
          {matches.map((name) => {
            const selected = value === name
            return (
              <button
                aria-checked={selected}
                aria-label={getProjectIconLabel(name)}
                className={cn(
                  "grid size-9 place-items-center rounded-xl border border-transparent text-muted-foreground transition-colors outline-none hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50",
                  selected &&
                    "border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                )}
                disabled={disabled}
                key={name}
                onClick={() => onChange(name)}
                role="radio"
                title={getProjectIconLabel(name)}
                type="button"
              >
                <ProjectIcon className="size-4" name={name} />
              </button>
            )
          })}
        </div>
      ) : (
        <p className="grid h-20 place-items-center rounded-2xl border border-border bg-muted/30 text-sm text-muted-foreground">
          No icons match &ldquo;{query.trim()}&rdquo;
        </p>
      )}
    </div>
  )
}
