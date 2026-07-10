import { Webhook } from "svix"

import { httpRouter } from "convex/server"

import { internal } from "./_generated/api"
import { env, httpAction } from "./_generated/server"

type ClerkWebhook = {
  type: string
  data: Record<string, unknown>
}

function text(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function record(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined
}

function membershipPayload(data: Record<string, unknown>) {
  const organization = record(data.organization)
  const user = record(data.public_user_data)
  const organizationId = text(organization?.id)
  const membershipId = text(data.id)
  const userId = text(user?.user_id)
  if (!organizationId || !membershipId || !userId) return null
  const firstName = text(user?.first_name)
  const lastName = text(user?.last_name)
  return {
    organizationId,
    membershipId,
    userId,
    role:
      data.role === "org:admin"
        ? ("org:admin" as const)
        : ("org:member" as const),
    displayName:
      [firstName, lastName].filter(Boolean).join(" ") ||
      text(user?.identifier) ||
      "Member",
    email: text(user?.identifier),
    imageUrl: text(user?.image_url),
  }
}

const clerkWebhook = httpAction(async (ctx, request) => {
  if (!env.CLERK_WEBHOOK_SIGNING_SECRET) {
    return new Response("Webhook not configured", { status: 503 })
  }
  const length = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(length) && length > 1_000_000) {
    return new Response("Payload too large", { status: 413 })
  }
  const body = await request.text()
  if (body.length > 1_000_000)
    return new Response("Payload too large", { status: 413 })
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  }
  if (Object.values(headers).some((header) => !header)) {
    return new Response("Missing signature", { status: 400 })
  }
  let event: ClerkWebhook
  try {
    event = new Webhook(env.CLERK_WEBHOOK_SIGNING_SECRET).verify(
      body,
      headers
    ) as ClerkWebhook
  } catch {
    return new Response("Invalid signature", { status: 400 })
  }

  if (
    event.type === "organization.created" ||
    event.type === "organization.updated"
  ) {
    const organizationId = text(event.data.id)
    const slug = text(event.data.slug)
    const name = text(event.data.name)
    if (organizationId && slug && name) {
      await ctx.runMutation(internal.organizations.upsertOrganization, {
        organizationId,
        slug,
        name,
      })
    }
  } else if (event.type === "organization.deleted") {
    const organizationId = text(event.data.id)
    if (organizationId) {
      await ctx.runMutation(internal.organizations.handleExternalDeletion, {
        organizationId,
      })
    }
  } else if (
    event.type === "organizationMembership.created" ||
    event.type === "organizationMembership.updated"
  ) {
    const membership = membershipPayload(event.data)
    if (membership)
      await ctx.runMutation(internal.organizations.upsertMember, membership)
  } else if (event.type === "organizationMembership.deleted") {
    const membership = membershipPayload(event.data)
    if (membership) {
      await ctx.runMutation(internal.organizations.removeMemberProjection, {
        organizationId: membership.organizationId,
        userId: membership.userId,
      })
    }
  }
  return new Response("ok", { status: 200 })
})

const http = httpRouter()

http.route({ path: "/clerk/webhooks", method: "POST", handler: clerkWebhook })

export default http
