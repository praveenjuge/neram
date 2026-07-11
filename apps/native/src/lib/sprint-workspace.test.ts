import { describe, expect, test } from "vitest"

import {
  cadenceUpdate,
  canManageOrganizationMember,
  toggledOrganizationRole,
} from "./sprint-workspace"

describe("native Sprint and workspace UI model", () => {
  const cadence = {
    cadenceWeeks: 2,
    startWeekday: 1,
    timezone: "UTC",
  }

  test("updates one cadence field without changing the others", () => {
    expect(cadenceUpdate(cadence, "weeks", "3")).toEqual({
      ...cadence,
      cadenceWeeks: 3,
    })
    expect(cadenceUpdate(cadence, "timezone", "Asia/Kolkata")).toEqual({
      ...cadence,
      timezone: "Asia/Kolkata",
    })
  })

  test("only admins can manage another member and roles toggle canonically", () => {
    expect(canManageOrganizationMember(true, "user_a", "user_b")).toBe(true)
    expect(canManageOrganizationMember(true, "user_a", "user_a")).toBe(false)
    expect(canManageOrganizationMember(false, "user_a", "user_b")).toBe(false)
    expect(toggledOrganizationRole("org:admin")).toBe("org:member")
    expect(toggledOrganizationRole("org:member")).toBe("org:admin")
  })
})
