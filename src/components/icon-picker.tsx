import {
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
  return (
    <div
      aria-label="Project icon"
      className="grid max-h-44 grid-cols-6 gap-1.5 overflow-y-auto pe-1 sm:grid-cols-9"
      role="radiogroup"
    >
      {PROJECT_ICON_NAMES.map((name) => {
        const selected = value === name
        return (
          <button
            aria-checked={selected}
            aria-label={name}
            className={cn(
              "grid size-9 place-items-center rounded-xl border border-border text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50",
              selected &&
                "border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
            )}
            disabled={disabled}
            key={name}
            onClick={() => onChange(name)}
            role="radio"
            type="button"
          >
            <ProjectIcon className="size-4" name={name} />
          </button>
        )
      })}
    </div>
  )
}
