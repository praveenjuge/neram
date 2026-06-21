import { Check } from "lucide-react"

import {
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
        return (
          <button
            aria-checked={selected}
            aria-label={name}
            className={cn(
              "grid size-7 place-items-center rounded-full text-white outline-none transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
              PROJECT_COLORS[name].swatch,
              selected && "ring-3 ring-ring/40"
            )}
            disabled={disabled}
            key={name}
            onClick={() => onChange(name)}
            role="radio"
            type="button"
          >
            {selected ? <Check className="size-4" /> : null}
          </button>
        )
      })}
    </div>
  )
}
