export const CLERK_MEMBERSHIP_PAGE_SIZE = 500

export async function visitClerkMembershipPages<T>(
  fetchPage: (pagination: {
    limit: number
    offset: number
  }) => Promise<{ data: T[]; totalCount: number }>,
  visitPage: (page: T[]) => Promise<void>
) {
  let offset = 0
  let totalCount: number | undefined
  do {
    const page = await fetchPage({
      limit: CLERK_MEMBERSHIP_PAGE_SIZE,
      offset,
    })
    totalCount = page.totalCount
    if (page.data.length === 0) {
      if (offset < totalCount) {
        throw new Error("Clerk membership pagination stopped before completion")
      }
      break
    }
    await visitPage(page.data)
    offset += page.data.length
  } while (offset < totalCount)
  return offset
}
