import { expect, test, vi } from "vitest"

import { createPlanningApi } from "../src/planning.js"

test("collects every bounded Organization member page", async () => {
  const first = {
    membershipId: "mem_1",
    userId: "user_1",
    role: "org:admin" as const,
    displayName: "Ada",
  }
  const second = {
    membershipId: "mem_2",
    userId: "user_2",
    role: "org:member" as const,
    displayName: "Bob",
  }
  const query = vi
    .fn()
    .mockResolvedValueOnce({
      page: [first],
      isDone: false,
      continueCursor: "next",
    })
    .mockResolvedValueOnce({
      page: [second],
      isDone: true,
      continueCursor: "",
    })
  const planning = createPlanningApi(
    { organizations: { members: "organizations:members" } },
    {
      query,
      mutation: vi.fn(),
      action: vi.fn(),
    }
  )

  await expect(planning.workspaceMembers()).resolves.toEqual([first, second])
  expect(query).toHaveBeenNthCalledWith(1, "organizations:members", {
    paginationOpts: { cursor: null, numItems: 100 },
  })
  expect(query).toHaveBeenNthCalledWith(2, "organizations:members", {
    paginationOpts: { cursor: "next", numItems: 100 },
  })
})
