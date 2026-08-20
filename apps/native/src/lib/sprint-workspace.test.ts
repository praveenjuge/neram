import { describe, expect, test } from "vitest"

import {
  canManageOrganizationMember,
  toggledOrganizationRole,
} from "./sprint-workspace"

describe("native Sprint and workspace UI model", () => {
  test("only admins can manage another member and roles toggle canonically", () => {
    expect(canManageOrganizationMember(true, "user_a", "user_b")).toBe(true)
    expect(canManageOrganizationMember(true, "user_a", "user_a")).toBe(false)
    expect(canManageOrganizationMember(false, "user_a", "user_b")).toBe(false)
    expect(toggledOrganizationRole("org:admin")).toBe("org:member")
    expect(toggledOrganizationRole("org:member")).toBe("org:admin")
  })
})
