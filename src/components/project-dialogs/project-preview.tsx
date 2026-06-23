import { Shuffle } from "lucide-react"

import {
  getProjectColorLabel,
  type ProjectColorName,
} from "@/lib/project-colors"
import { getProjectIconLabel, type ProjectIconName } from "@/lib/project-icons"
import { Button } from "@/components/ui/button"

import { IconPreview } from "./icon-preview"

type ProjectPreviewProps = {
  name: string
  icon: ProjectIconName
  color: ProjectColorName
  /** When provided, renders a button that re-rolls the icon and color. */
  onShuffle?: () => void
}

/**
 * Live header shown at the top of the new/edit project dialogs. Reflects the
 * current name, icon, and color as the user edits them, so the choices read as
 * "this is what the project card will look like".
 */
export function ProjectPreview({
  name,
  icon,
  color,
  onShuffle,
}: ProjectPreviewProps) {
  const trimmed = name.trim()
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3">
      <IconPreview color={color} icon={icon} size="lg" />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="truncate font-medium text-foreground">
          {trimmed || "Untitled project"}
        </p>
        <p className="truncate text-xs text-muted-foreground capitalize">
          {getProjectColorLabel(color)} · {getProjectIconLabel(icon)}
        </p>
      </div>
      {onShuffle ? (
        <Button
          aria-label="Shuffle icon and color"
          onClick={onShuffle}
          size="icon-sm"
          title="Shuffle icon and color"
          type="button"
          variant="secondary"
        >
          <Shuffle />
        </Button>
      ) : null}
    </div>
  )
}
