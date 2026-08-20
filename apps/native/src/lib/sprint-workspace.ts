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
