import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { describe, expect, test, vi } from "vitest"

import { AgentError, type NeramApi } from "../src/agent.js"
import { createNeramMcpServer } from "../src/mcp.js"

function fakeApi(overrides: Partial<NeramApi> = {}): NeramApi {
  return {
    projects: vi.fn(async () => [
      { _id: "pa", name: "Agent Core", role: "owner" as const, taskCount: 1, todoCount: 1, inProgressCount: 0, doneCount: 0, updatedAt: 1 },
      { _id: "pb", name: "Agent Ops", role: "owner" as const, taskCount: 0, todoCount: 0, inProgressCount: 0, doneCount: 0, updatedAt: 1 },
    ]),
    tasks: vi.fn(async () => []),
    assignedTasks: vi.fn(async () => []),
    activity: vi.fn(async () => []),
    createTask: vi.fn(async () => "tc"),
    updateTask: vi.fn(async () => undefined),
    moveTask: vi.fn(async () => undefined),
    changeTaskProject: vi.fn(async () => undefined),
    removeTask: vi.fn(async () => undefined),
    createProject: vi.fn(async () => "pnew"),
    updateProject: vi.fn(async () => undefined),
    removeProject: vi.fn(async () => undefined),
    checkIn: vi.fn(async () => 1),
    status: vi.fn(async () => ({
      identity: { name: "Ada", email: "ada@example.com" },
      workspace: { projects: 3, ownedProjects: 2, sharedProjects: 1, openTasks: 5 },
    })),
    ...overrides,
  }
}

async function connect(api: NeramApi) {
  const server = createNeramMcpServer(api)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "0.0.0" })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return { server, client }
}

function packageVersion() {
  const path = join(dirname(fileURLToPath(import.meta.url)), "../package.json")
  return JSON.parse(readFileSync(path, "utf8")).version as string
}

describe("neram mcp server", () => {
  test("registers the workspace and new listing/mutation tools", async () => {
    const { server, client } = await connect(fakeApi())
    try {
      const { tools } = await client.listTools()
      const names = tools.map((tool) => tool.name)
      expect(names).toEqual(expect.arrayContaining([
        "workspace_status",
        "list_projects",
        "list_tasks",
        "recent_activity",
        "update_task",
        "delete_task",
        "move_task_to_project",
        "create_project",
        "update_project",
        "delete_project",
      ]))
    } finally {
      await client.close()
      await server.close()
    }
  })

  test("workspace_status returns structured workspace totals", async () => {
    const api = fakeApi()
    const { server, client } = await connect(api)
    try {
      const result = await client.callTool({ name: "workspace_status", arguments: {} })
      expect(result.structuredContent).toEqual({
        identity: { name: "Ada", email: "ada@example.com" },
        workspace: { projects: 3, ownedProjects: 2, sharedProjects: 1, openTasks: 5 },
      })
      expect(api.status).toHaveBeenCalledOnce()
    } finally {
      await client.close()
      await server.close()
    }
  })

  test("advertises tool annotations", async () => {
    const { server, client } = await connect(fakeApi())
    try {
      const { tools } = await client.listTools()
      const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations]))
      expect(byName.daily_brief?.readOnlyHint).toBe(true)
      expect(byName.list_projects?.readOnlyHint).toBe(true)
      expect(byName.capture_task?.readOnlyHint).toBe(false)
      expect(byName.update_task?.idempotentHint).toBe(true)
      expect(byName.delete_task?.destructiveHint).toBe(true)
      expect(byName.delete_project?.destructiveHint).toBe(true)
    } finally {
      await client.close()
      await server.close()
    }
  })

  test("advertises the package version", async () => {
    const { server, client } = await connect(fakeApi())
    try {
      expect(client.getServerVersion()).toMatchObject({ name: "neram", version: packageVersion() })
    } finally {
      await client.close()
      await server.close()
    }
  })

  test("returns tool failures as isError results with code and details", async () => {
    // Both projects contain "agent" with no exact match, so the ref is ambiguous.
    const { server, client } = await connect(fakeApi())
    try {
      const result = await client.callTool({ name: "summarize_project", arguments: { project: "agent" } })
      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0].text
      const payload = JSON.parse(text) as { error: { code: string; details?: { matches?: unknown[] } } }
      expect(payload.error.code).toBe("AMBIGUOUS")
      expect(payload.error.details?.matches).toBeDefined()
    } finally {
      await client.close()
      await server.close()
    }
  })

  test("surfaces backend errors as isError instead of throwing", async () => {
    const api = fakeApi({
      createProject: vi.fn(async () => {
        throw new AgentError("FORBIDDEN", "Nope.")
      }),
    })
    const { server, client } = await connect(api)
    try {
      const result = await client.callTool({ name: "create_project", arguments: { name: "Launch" } })
      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0].text
      expect(JSON.parse(text)).toMatchObject({ error: { code: "FORBIDDEN", message: "Nope." } })
    } finally {
      await client.close()
      await server.close()
    }
  })
})
