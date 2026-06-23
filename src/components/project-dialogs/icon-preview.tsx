import { getProjectColorBox, type ProjectColorName } from "@/lib/project-colors"
import { ProjectIcon, type ProjectIconName } from "@/lib/project-icons"
import { cn } from "@/lib/utils"

const SIZES = {
  md: { box: "size-11 rounded-2xl", icon: "size-5" },
  lg: { box: "size-14 rounded-[18px]", icon: "size-7" },
} as const

export function IconPreview({
  color,
  icon,
  size = "md",
}: {
  color: ProjectColorName
  icon: ProjectIconName
  size?: keyof typeof SIZES
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center",
        SIZES[size].box,
        getProjectColorBox(color)
      )}
      data-testid="project-icon-preview"
    >
      <ProjectIcon className={SIZES[size].icon} name={icon} />
    </span>
  )
}
