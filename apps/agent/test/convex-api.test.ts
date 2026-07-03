import { beforeEach, describe, expect, test, vi } from "vitest"

// Mock the Convex HTTP client so we can observe how createConvexApi resolves the
// token and authenticates before each request, without touching the network.
const mock = vi.hoisted(() => ({
  setAuth: vi.fn(),
  query: vi.fn(async () => [] as unknown),
  mutation: vi.fn(async () => "ok" as unknown),
}))

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAuth = mock.setAuth
    query = mock.query
    mutation = mock.mutation
  },
}))

const { createConvexApi } = await import("../src/agent.js")

beforeEach(() => {
  mock.setAuth.mockClear()
  mock.query.mockClear()
  mock.mutation.mockClear()
})

describe("createConvexApi token provider", () => {
  test("resolves a function token before every request", async () => {
    let n = 0
    const provider = vi.fn(async () => `token-${++n}`)
    const api = createConvexApi("https://example.convex.cloud", provider)
    await api.projects()
    await api.status()
    expect(provider).toHaveBeenCalledTimes(2)
    expect(mock.setAuth).toHaveBeenNthCalledWith(1, "token-1")
    expect(mock.setAuth).toHaveBeenNthCalledWith(2, "token-2")
  })

  test("accepts a static string token", async () => {
    const api = createConvexApi("https://example.convex.cloud", "static-token")
    await api.projects()
    expect(mock.setAuth).toHaveBeenCalledWith("static-token")
  })

  test("re-authenticates before mutations too", async () => {
    const provider = vi.fn(async () => "m-token")
    const api = createConvexApi("https://example.convex.cloud", provider)
    await api.createTask({ projectId: "pa", title: "x" })
    expect(provider).toHaveBeenCalledTimes(1)
    expect(mock.setAuth).toHaveBeenCalledWith("m-token")
    expect(mock.mutation).toHaveBeenCalledOnce()
  })
})
