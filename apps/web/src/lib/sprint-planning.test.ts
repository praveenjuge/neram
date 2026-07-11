import { describe, expect, test } from "vitest"

import {
  findOrganizationBySlug,
  groupBacklogTasks,
  membershipLookupState,
} from "./sprint-planning"

describe("Sprint planning UI model", () => {
  test("groups matching Backlog tasks while preserving project order", () => {
    const tasks = [
      { title: "Second", projectName: "Alpha", position: 20 },
      { title: "First", projectName: "Alpha", position: 10 },
      { title: "Release", projectName: "Beta", position: 5 },
    ]
    expect(groupBacklogTasks(tasks, "alpha")).toEqual([
      ["Alpha", [tasks[1], tasks[0]]],
    ])
    expect(groupBacklogTasks(tasks, "release")).toEqual([["Beta", [tasks[2]]]])
  })

  test("resolves a slug deep link only to the matching membership", () => {
    const memberships = [
      { organization: { id: "org_alpha", slug: "alpha" } },
      { organization: { id: "org_beta", slug: "beta" } },
    ]
    expect(findOrganizationBySlug(memberships, "beta")).toBe(memberships[1])
    expect(findOrganizationBySlug(memberships, "gamma")).toBeUndefined()
  })

  test("loads every membership page before rejecting a workspace slug", () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      organization: { id: `org_${index}`, slug: `workspace-${index}` },
    }))
    const target = {
      organization: { id: "org_target", slug: "target-workspace" },
    }
    const page = {
      listLoaded: true,
      hasMatch: Boolean(findOrganizationBySlug(firstPage, "target-workspace")),
      hasNextPage: true,
      isFetching: false,
      isError: false,
    }
    expect(membershipLookupState(page)).toBe("fetch-next")
    expect(membershipLookupState({ ...page, isFetching: true })).toBe(
      "loading"
    )
    const loadedMemberships = [...firstPage, target]
    expect(
      membershipLookupState({
        ...page,
        hasMatch: Boolean(
          findOrganizationBySlug(loadedMemberships, "target-workspace")
        ),
      })
    ).toBe("found")
    expect(membershipLookupState({ ...page, hasNextPage: false })).toBe(
      "missing"
    )
    expect(membershipLookupState({ ...page, isError: true })).toBe("error")
  })
})
