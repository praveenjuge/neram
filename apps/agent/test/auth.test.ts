import { expect, test } from "vitest"

import { requireOrganizationClaims } from "../src/auth.js"

function token(payload: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`
}

test("Organization-bound sessions require id, slug, and a canonical role", () => {
  expect(
    requireOrganizationClaims(
      token({
        sub: "user_1",
        org_id: "org_1",
        org_slug: "acme",
        org_role: "org:member",
      })
    )
  ).toMatchObject({
    org_id: "org_1",
    org_slug: "acme",
    org_role: "org:member",
  })
  for (const payload of [
    { sub: "user_1" },
    { org_id: "org_1", org_role: "org:member" },
    { org_id: "org_1", org_slug: "acme", org_role: "owner" },
  ]) {
    expect(() => requireOrganizationClaims(token(payload))).toThrow(
      "Choose a Neram workspace"
    )
  }
})
