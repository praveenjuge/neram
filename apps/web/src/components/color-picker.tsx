import { Check } from "lucide-react"

import {
  getProjectColorLabel,
  PROJECT_COLORS,
  PROJECT_COLOR_NAMES,
  type ProjectColorName,
} from "@/lib/project-colors"
import { cn } from "@/lib/utils"

type ColorPickerProps = {
  value: ProjectColorName
  onChange: (color: ProjectColorName) => void
  disabled?: boolean
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  return (
    <div
      aria-label="Project color"
      className="flex flex-wrap gap-2"
      role="radiogroup"
    >
      {PROJECT_COLOR_NAMES.map((name) => {
        const selected = value === name
        const label = getProjectColorLabel(name)
        return (
          <button
            aria-checked={selected}
            aria-label={label}
            className={cn(
              "grid size-8 place-items-center rounded-full text-white shadow-sm ring-offset-2 ring-offset-popover transition-[transform,box-shadow] outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50",
              PROJECT_COLORS[name].swatch,
              selected && "ring-2 ring-foreground/70 hover:scale-100"
            )}
            disabled={disabled}
            key={name}
            onClick={() => onChange(name)}
            role="radio"
            title={label}
            type="button"
          >
            {selected ? <Check className="size-4" strokeWidth={3} /> : null}
          </button>
        )
      })}
    </div>
  )
}
