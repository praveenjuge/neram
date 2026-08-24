import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { expect, test, vi } from "vitest"

import { requireOrganizationClaims } from "../src/session.js"

// readSession() falls back to ~/.config/neram/credentials.json when the OS
// keyring is unavailable; force that path so tests are deterministic and never
// touch a real keyring or a real saved session.
vi.mock("@napi-rs/keyring", () => ({
  Entry: class {
    getPassword() {
      throw new Error("no keyring in tests")
    }
  },
}))

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

async function withFakeHome(
  fn: (home: string) => Promise<void>
): Promise<number> {
  const home = mkdtempSync(join(tmpdir(), "neram-auth-test-"))
  const previous = process.env.HOME
  process.env.HOME = home
  try {
    await fn(home)
  } finally {
    process.env.HOME = previous
    rmSync(home, { recursive: true, force: true })
  }
  return 0
}

test("authClientSession never refreshes (or touches the network) at startup", async () => {
  await withFakeHome(async (home) => {
    const dir = join(home, ".config", "neram")
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, "credentials.json"),
      JSON.stringify({
        idToken: token({ sub: "user_1", org_id: "org_1" }),
        refreshToken: "rt_1",
        expiresAt: Date.now() - 60_000, // expired → would trigger refresh
        config: {
          convexUrl: "https://example.convex.cloud",
          clerkFrontendApiUrl: "https://127.0.0.1:1", // unreachable → fast fail
          oauthClientId: "test",
        },
      }),
      { mode: 0o600 }
    )
    vi.resetModules()
    const { authClientSession } = await import("../src/auth.js")
    // Startup must resolve without throwing and without any network call:
    // the token is expired, yet we only discover that lazily.
    const started = await authClientSession()
    expect(started.session).not.toBeNull()
    expect(started.convexUrl).toBe("https://example.convex.cloud")
    expect(started.getToken).toBeTypeOf("function")
    // The first actual token request hits the unreachable endpoint and fails
    // with a structured UNAUTHENTICATED error, never an uncaught throw.
    // (assert on the code property: after vi.resetModules() the dynamically
    // imported module carries a distinct AgentError class identity)
    const err = await started.getToken!().then(
      () => null,
      (e: unknown) => e
    )
    expect(err).not.toBeNull()
    expect((err as { code?: string }).code).toBe("UNAUTHENTICATED")
  })
})
