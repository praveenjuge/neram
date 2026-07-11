import { Webhook } from "svix"
import { expect, test } from "vitest"

import { verifyClerkWebhook } from "./clerkWebhook"

test("Clerk webhook verification accepts authentic signatures and rejects tampering", () => {
  const secret = `whsec_${Buffer.from("neram-webhook-test-secret").toString("base64")}`
  const webhook = new Webhook(secret)
  const body = JSON.stringify({
    type: "organization.updated",
    data: { id: "org_acme", slug: "acme", name: "Acme" },
  })
  const id = "msg_test"
  const timestamp = new Date()
  const headers = {
    "svix-id": id,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1_000)),
    "svix-signature": webhook.sign(id, timestamp, body),
  }

  expect(verifyClerkWebhook(body, headers, secret)).toMatchObject({
    type: "organization.updated",
  })
  expect(() => verifyClerkWebhook(`${body} `, headers, secret)).toThrow()
})
