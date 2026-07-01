import { format } from "date-fns"
import { CalendarIcon, X } from "lucide-react"
import { useState } from "react"

import { DUE_DATE_FORMAT, parseDueDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * A shadcn calendar in a popover for picking an optional due date. `value` is
 * the stored `yyyy-MM-dd` string (empty when unset); `onChange` receives the
 * next string, with `""` meaning "cleared".
 */
export function DueDatePicker({
  value,
  onChange,
  id,
  testId,
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  testId?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = parseDueDate(value)

  return (
    <div className="flex items-center gap-2">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            className={cn(
              "flex-1 justify-start font-normal",
              !selected && "text-muted-foreground"
            )}
            data-testid={testId}
            id={id}
            type="button"
            variant="outline"
          >
            <CalendarIcon />
            {selected ? format(selected, "MMM d, yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            autoFocus
            mode="single"
            onSelect={(date) => {
              onChange(date ? format(date, DUE_DATE_FORMAT) : "")
              setOpen(false)
            }}
            selected={selected}
          />
        </PopoverContent>
      </Popover>
      {selected ? (
        <Button
          aria-label="Clear due date"
          onClick={() => onChange("")}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X />
        </Button>
      ) : null}
    </div>
  )
}
