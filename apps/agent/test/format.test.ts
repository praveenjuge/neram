import { describe, expect, test } from "vitest"

import {
  formatError,
  formatLogin,
  formatLogout,
  formatWhoami,
  loginPayload,
  logoutPayload,
  MCP_INFO,
  whoamiPayload,
} from "../src/format.js"

const convexUrl = "https://example.convex.cloud"
const workspace = { projects: 3, ownedProjects: 2, sharedProjects: 1, openTasks: 5 }

describe("human formatting", () => {
  test("login greets the user and lists next commands", () => {
    const text = formatLogin({ user: { name: "Ada", email: "ada@example.com" }, convexUrl })
    expect(text).toContain("You are now logged in as Ada <ada@example.com>.")
    expect(text).toContain(convexUrl)
    expect(text).toContain("neram whoami")
    expect(text).toContain("neram daily")
    expect(text).toContain("neram mcp")
  })

  test("login falls back to a generic label without claims", () => {
    expect(formatLogin({ user: {}, convexUrl })).toContain("logged in as your account.")
  })

  test("whoami shows identity, counts, and MCP hints", () => {
    const text = formatWhoami({
      identity: { name: "Ada", email: "ada@example.com" },
      convexUrl,
      workspace,
      expiresAt: Date.now() + 60 * 60 * 1000,
      hasRefreshToken: true,
    })
    expect(text).toContain("Logged in as Ada <ada@example.com>.")
    expect(text).toContain("Projects:   3 (2 owned, 1 shared)")
    expect(text).toContain("Open tasks: 5")
    expect(text).toContain(MCP_INFO.hosted)
    expect(text).not.toContain("Heads up")
  })

  test("whoami warns when a non-refreshable session is near expiry", () => {
    const text = formatWhoami({
      identity: { name: "Ada" },
      convexUrl,
      workspace,
      expiresAt: Date.now() + 60 * 1000,
      hasRefreshToken: false,
    })
    expect(text).toContain("can't refresh")
    expect(text).toContain("neram login")
  })

  test("logout reports each revocation outcome", () => {
    expect(formatLogout({ revocation: "succeeded", configRetained: true })).toContain("Refresh token revoked.")
    expect(formatLogout({ revocation: "skipped", configRetained: true })).toContain("revocation skipped")
    expect(formatLogout({ revocation: "failed", configRetained: true })).toContain("revocation failed")
    expect(formatLogout({ revocation: "succeeded", configRetained: true })).toContain("Cached workspace config kept")
  })

  test("errors are compact with an actionable hint", () => {
    const text = formatError({ code: "UNAUTHENTICATED", message: "Run `neram login` first." })
    expect(text).toContain("Run `neram login` first.")
    expect(text).toContain("Run `neram login` to sign in.")
    // Unknown codes fall back to just the message.
    expect(formatError({ code: "WEIRD", message: "Boom." })).toBe("Boom.")
  })
})

describe("additive JSON payloads", () => {
  test("login preserves ok/user/convexUrl and adds mcp", () => {
    const user = { name: "Ada", email: "ada@example.com" }
    expect(loginPayload(user, convexUrl)).toEqual({ ok: true, user, convexUrl, mcp: MCP_INFO })
  })

  test("whoami preserves ok/user/convexUrl and adds workspace + mcp", () => {
    const user = { sub: "user_1" }
    expect(whoamiPayload(user, convexUrl, workspace)).toEqual({
      ok: true,
      user,
      convexUrl,
      workspace,
      mcp: MCP_INFO,
    })
  })

  test("logout exposes configRetained and revocation", () => {
    expect(logoutPayload({ revocation: "failed", configRetained: true })).toEqual({
      ok: true,
      configRetained: true,
      revocation: "failed",
    })
  })
})
