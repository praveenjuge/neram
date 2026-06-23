import { getProjectColorBox, type ProjectColorName } from "@/lib/project-colors"
import { ProjectIcon, type ProjectIconName } from "@/lib/project-icons"
import { cn } from "@/lib/utils"

export function IconPreview({
  color,
  icon,
}: {
  color: ProjectColorName
  icon: ProjectIconName
}) {
  return (
    <span
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-2xl",
        getProjectColorBox(color)
      )}
      data-testid="project-icon-preview"
    >
      <ProjectIcon className="size-5" name={icon} />
    </span>
  )
}
