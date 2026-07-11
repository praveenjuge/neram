import { useUser } from "@clerk/nextjs"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UserAvatar } from "@/components/user-avatar"
import { useOrganizationMembers } from "@/lib/use-organization-members"

// Radix Select items can't use an empty-string value, so the "no one" option
// gets its own sentinel that the forms translate back to "no assignee".
export const UNASSIGNED = "unassigned"

/**
 * An optional assignee picker listing everyone in the active Organization.
 * plus an "Unassigned" option. `value` is a member subject or `UNASSIGNED`;
 * `onChange` reports the chosen subject and its display name (null when cleared)
 * so the caller can persist both for the optimistic UI.
 */
export function AssigneeSelect({
  value,
  onChange,
  id,
  enabled = true,
}: {
  value: string
  onChange: (subject: string, name: string | null) => void
  id: string
  enabled?: boolean
}) {
  // Only subscribe while the form is open so closed dialogs don't hold a
  // members subscription open.
  const { members } = useOrganizationMembers(enabled)
  const { user } = useUser()

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Assignee (optional)</Label>
      <Select
        onValueChange={(next) => {
          if (next === UNASSIGNED) {
            onChange(UNASSIGNED, null)
            return
          }
          const member = members.find((candidate) => candidate.userId === next)
          onChange(next, member?.displayName ?? null)
        }}
        value={value}
      >
        <SelectTrigger
          className="w-full"
          data-testid="task-assignee-select"
          id={id}
        >
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            data-testid="assignee-option-unassigned"
            value={UNASSIGNED}
          >
            Unassigned
          </SelectItem>
          {members.map((member) => (
            <SelectItem
              data-testid="assignee-option"
              key={member.userId}
              value={member.userId}
            >
              <UserAvatar className="size-5" name={member.displayName} />
              {member.displayName}
              {member.userId === user?.id ? " (you)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
