import { useQuery } from "convex-helpers/react/cache"

import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { getProjectColorText } from "@/lib/project-colors"
import { ProjectIcon } from "@/lib/project-icons"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Project picker listing every project the caller can access (owned + shared),
 * each shown with its own icon + color glyph. `value` is the current project
 * id; `onChange` reports the chosen project id so the caller can move the task
 * there. Only subscribes while `enabled` so closed dialogs don't hold a query
 * subscription open.
 */
export function ProjectSelect({
  value,
  onChange,
  id,
  enabled = true,
}: {
  value: Id<"projects">
  onChange: (projectId: Id<"projects">) => void
  id: string
  enabled?: boolean
}) {
  const projects = useQuery(api.projects.names, enabled ? {} : "skip")

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Project</Label>
      <Select
        onValueChange={(next) => onChange(next as Id<"projects">)}
        value={value}
      >
        <SelectTrigger
          className="w-full"
          data-testid="task-project-select"
          id={id}
        >
          <SelectValue placeholder="Select a project" />
        </SelectTrigger>
        <SelectContent>
          {projects?.map((project) => (
            <SelectItem
              data-testid="project-option"
              key={project._id}
              value={project._id}
            >
              <ProjectIcon
                className={getProjectColorText(project.color)}
                name={project.icon}
              />
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
