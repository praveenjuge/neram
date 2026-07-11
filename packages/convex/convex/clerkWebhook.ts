import { Webhook } from "svix"

export type ClerkWebhook = {
  type: string
  data: Record<string, unknown>
}

export function verifyClerkWebhook(
  body: string,
  headers: Record<string, string>,
  signingSecret: string
) {
  return new Webhook(signingSecret).verify(body, headers) as ClerkWebhook
}
