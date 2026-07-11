/// <reference types="vite/client" />
import { expect, test } from "vitest"

import {
  CLERK_MEMBERSHIP_PAGE_SIZE,
  visitClerkMembershipPages,
} from "./organizationPagination"

test("visits every Clerk membership page beyond the 500-item API limit", async () => {
  const members = Array.from({ length: 501 }, (_, index) => `user_${index}`)
  const offsets: number[] = []
  const visited: string[] = []

  const count = await visitClerkMembershipPages(
    async ({ limit, offset }) => {
      offsets.push(offset)
      return {
        data: members.slice(offset, offset + limit),
        totalCount: members.length,
      }
    },
    async (page) => {
      visited.push(...page)
    }
  )

  expect(CLERK_MEMBERSHIP_PAGE_SIZE).toBe(500)
  expect(offsets).toEqual([0, 500])
  expect(visited).toEqual(members)
  expect(count).toBe(501)
})

test("fails closed if Clerk reports more memberships but returns no page", async () => {
  await expect(
    visitClerkMembershipPages(
      async () => ({ data: [], totalCount: 1 }),
      async () => undefined
    )
  ).rejects.toThrow("stopped before completion")
})
