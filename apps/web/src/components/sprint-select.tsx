import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type SprintPlacement = "backlog" | "current" | "upcoming"

export function SprintSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: SprintPlacement
  onChange: (placement: SprintPlacement) => void
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Sprint</Label>
      <Select onValueChange={(next) => onChange(next as SprintPlacement)} value={value}>
        <SelectTrigger className="w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="backlog">Backlog</SelectItem>
          <SelectItem value="current">Current</SelectItem>
          <SelectItem value="upcoming">Upcoming</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
