import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { describe, expect, test, vi } from "vitest"

import type { NeramApi } from "../src/agent.js"
import { createNeramMcpServer } from "../src/mcp.js"

function fakeApi(): NeramApi {
  return {
    projects: vi.fn(async () => []),
    tasks: vi.fn(async () => []),
    assignedTasks: vi.fn(async () => []),
    activity: vi.fn(async () => []),
    createTask: vi.fn(async () => "tc"),
    moveTask: vi.fn(async () => undefined),
    checkIn: vi.fn(async () => 1),
    status: vi.fn(async () => ({
      identity: { name: "Ada", email: "ada@example.com" },
      workspace: { projects: 3, ownedProjects: 2, sharedProjects: 1, openTasks: 5 },
    })),
  }
}

async function connect(api: NeramApi) {
  const server = createNeramMcpServer(api)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "0.0.0" })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return { server, client }
}

describe("neram mcp server", () => {
  test("registers the workspace_status tool", async () => {
    const { server, client } = await connect(fakeApi())
    try {
      const { tools } = await client.listTools()
      expect(tools.map((tool) => tool.name)).toContain("workspace_status")
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
})
