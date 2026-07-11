import { convexTest } from "convex-test"

import { internal } from "../convex/_generated/api"
import schema from "../convex/schema"

type Modules = Record<string, () => Promise<unknown>>

export async function organizationFixture(modules: Modules) {
  const t = convexTest(schema, modules)
  await t.mutation(internal.organizations.upsertOrganization, {
    organizationId: "org_acme",
    slug: "acme",
    name: "Acme",
  })
  for (const member of [
    { userId: "user_alice", role: "org:admin" as const, displayName: "Alice" },
    { userId: "user_bob", role: "org:member" as const, displayName: "Bob" },
  ]) {
    await t.mutation(internal.organizations.upsertMember, {
      organizationId: "org_acme",
      membershipId: `mem_${member.userId}`,
      ...member,
    })
  }
  const identity = (
    userId: string,
    name: string,
    role: "org:admin" | "org:member"
  ) =>
    t.withIdentity({
      name,
      subject: userId,
      tokenIdentifier: `https://clerk.test|${userId}`,
      org_id: "org_acme",
      org_slug: "acme",
      org_role: role,
    })
  return {
    t,
    alice: identity("user_alice", "Alice", "org:admin"),
    bob: identity("user_bob", "Bob", "org:member"),
  }
}
