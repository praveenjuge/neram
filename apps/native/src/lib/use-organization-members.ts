import { api } from "@neram/convex/api"
import { usePaginatedQuery } from "convex/react"
import { useEffect } from "react"

const MEMBER_PAGE_SIZE = 100

export function useOrganizationMembers() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.organizations.members,
    {},
    { initialNumItems: MEMBER_PAGE_SIZE }
  )
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(MEMBER_PAGE_SIZE)
  }, [loadMore, status])
  return {
    members: results,
    loading: status === "LoadingFirstPage" || status === "LoadingMore",
  }
}
