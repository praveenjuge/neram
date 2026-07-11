import { expect, test } from "vitest"

import { requireOrganizationClaims } from "../src/session.js"

function token(payload: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`
}

test("Organization-bound OAuth sessions require the selected Organization id", () => {
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
  })
  for (const payload of [
    { sub: "user_1" },
    { sub: "user_1", org_id: null },
    { sub: "user_1", org_id: "" },
  ]) {
    expect(() => requireOrganizationClaims(token(payload))).toThrow(
      "Choose a Neram workspace"
    )
  }
})
