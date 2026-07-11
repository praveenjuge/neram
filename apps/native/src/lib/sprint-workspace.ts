export type Cadence = {
  cadenceWeeks: number
  startWeekday: number
  timezone: string
}

export function cadenceUpdate(
  current: Cadence,
  field: "weeks" | "weekday" | "timezone",
  rawValue: string
): Cadence {
  const value = rawValue.trim()
  return {
    cadenceWeeks: field === "weeks" ? Number(value) : current.cadenceWeeks,
    startWeekday: field === "weekday" ? Number(value) : current.startWeekday,
    timezone: field === "timezone" ? value : current.timezone,
  }
}

export function canManageOrganizationMember(
  isAdmin: boolean,
  currentUserId: string | undefined,
  targetUserId: string | undefined
) {
  return Boolean(
    isAdmin && targetUserId && currentUserId && targetUserId !== currentUserId
  )
}

export function toggledOrganizationRole(role: string) {
  return role === "org:admin" ? "org:member" : "org:admin"
}
