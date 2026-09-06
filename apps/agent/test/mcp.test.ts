import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, test, vi } from "vitest"

import { AgentError, createConvexApi, type NeramApi } from "../src/agent.js"
import { createNeramMcpServer } from "../src/mcp.js"

function fakeApi(overrides: Partial<NeramApi> = {}): NeramApi {
  const organization = {
    organizationId: "org_1",
    slug: "acme",
    name: "Acme",
    state: "active" as const,
  }
  const membership = {
    membershipId: "mem_1",
    userId: "user_1",
    role: "org:admin" as const,
    displayName: "Ada",
  }
  return {
    syncCurrentWorkspace: vi.fn(async () => undefined),
    currentWorkspace: vi.fn(async () => ({
      organization,
      membership,
      settings: {
        sprintDuration: 2 as const,
      },
    })),
    workspaceMembers: vi.fn(async () => [membership]),
    createWorkspace: vi.fn(async () => organization),
    inviteWorkspaceMember: vi.fn(async () => ({
      invitationId: "inv_1",
      status: "pending",
    })),
    updateWorkspaceMemberRole: vi.fn(async () => undefined),
    removeWorkspaceMember: vi.fn(async () => undefined),
    deleteWorkspace: vi.fn(async () => "job_delete"),
    currentSprint: vi.fn(async () => null),
    backlogTasks: vi.fn(async () => []),
    sprintHistory: vi.fn(async () => ({
      page: [],
      isDone: true,
      continueCursor: "",
    })),
    planSprintTasks: vi.fn(async () => undefined),
    removeSprintTasks: vi.fn(async () => undefined),
    updateSprintGoal: vi.fn(async () => undefined),
    updateSprintDuration: vi.fn(async () => undefined),
    startSprint: vi.fn(async () => "sprint_new"),
    endSprint: vi.fn(async () => "job_close"),
    projects: vi.fn(async () => [
      {
        _id: "pa",
        name: "Agent Core",
        role: "org:admin" as const,
        taskCount: 1,
        todoCount: 1,
        inProgressCount: 0,
        doneCount: 0,
        updatedAt: 1,
      },
      {
        _id: "pb",
        name: "Agent Ops",
        role: "org:admin" as const,
        taskCount: 0,
        todoCount: 0,
        inProgressCount: 0,
        doneCount: 0,
        updatedAt: 1,
      },
    ]),
    tasks: vi.fn(async () => []),
    task: vi.fn(async () => null),
    assignedTasks: vi.fn(async () => []),
    activity: vi.fn(async () => []),
    createTask: vi.fn(async () => "tc"),
    updateTask: vi.fn(async () => undefined),
    moveTask: vi.fn(async () => undefined),
    changeTaskProject: vi.fn(async () => undefined),
    removeTask: vi.fn(async () => ({ subtaskCount: 0, commentCount: 0 })),
    subtasks: vi.fn(async () => []),
    createSubtask: vi.fn(async () => "st"),
    renameSubtask: vi.fn(async () => undefined),
    setSubtaskCompleted: vi.fn(async () => undefined),
    reorderSubtask: vi.fn(async () => undefined),
    removeSubtask: vi.fn(async () => undefined),
    comments: vi.fn(async () => ({
      page: [],
      isDone: true,
      continueCursor: "",
    })),
    createComment: vi.fn(async () => "co"),
    replyToComment: vi.fn(async () => "cr"),
    editComment: vi.fn(async () => undefined),
    removeComment: vi.fn(async () => undefined),
    createProject: vi.fn(async () => "pnew"),
    updateProject: vi.fn(async () => undefined),
    removeProject: vi.fn(async () => undefined),
    status: vi.fn(async () => ({
      identity: { name: "Ada", email: "ada@example.com" },
      organization: {
        organizationId: organization.organizationId,
        slug: organization.slug,
        name: organization.name,
        role: membership.role,
      },
      workspace: { projects: 3, openTasks: 5 },
    })),
    ...overrides,
  }
}

async function connect(api: NeramApi) {
  const server = createNeramMcpServer(api)
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "0.0.0" })
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ])
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
      expect(names).toEqual(
        expect.arrayContaining([
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
          "get_task",
          "list_subtasks",
          "create_subtask",
          "rename_subtask",
          "set_subtask_completed",
          "reorder_subtask",
          "delete_subtask",
          "list_task_comments",
          "create_comment",
          "reply_to_comment",
          "edit_comment",
          "delete_comment",
          "get_workspace",
          "create_workspace",
          "list_workspace_members",
          "invite_workspace_member",
          "update_workspace_member_role",
          "remove_workspace_member",
          "delete_workspace",
          "get_sprint",
          "list_sprint_tasks",
          "sprint_history",
          "plan_sprint_tasks",
          "remove_sprint_tasks",
          "update_sprint_goal",
          "update_sprint_duration",
          "start_sprint",
          "end_sprint",
        ])
      )
    } finally {
      await client.close()
      await server.close()
    }
  })

  test("workspace_status returns structured workspace totals", async () => {
    const api = fakeApi()
    const { server, client } = await connect(api)
    try {
      const result = await client.callTool({
        name: "workspace_status",
        arguments: {},
      })
      expect(result.structuredContent).toEqual({
        identity: { name: "Ada", email: "ada@example.com" },
        organization: {
          organizationId: "org_1",
          slug: "acme",
          name: "Acme",
          role: "org:admin",
        },
        workspace: { projects: 3, openTasks: 5 },
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
      const byName = Object.fromEntries(
        tools.map((tool) => [tool.name, tool.annotations])
      )
      expect(byName.daily_brief?.readOnlyHint).toBe(true)
      expect(byName.list_projects?.readOnlyHint).toBe(true)
      expect(byName.capture_task?.readOnlyHint).toBe(false)
      expect(byName.update_task?.idempotentHint).toBe(true)
      expect(byName.delete_task?.destructiveHint).toBe(true)
      expect(byName.delete_project?.destructiveHint).toBe(true)
      expect(byName.get_task?.readOnlyHint).toBe(true)
      expect(byName.list_task_comments?.readOnlyHint).toBe(true)
      expect(byName.create_comment?.idempotentHint).not.toBe(true)
      expect(byName.rename_subtask?.idempotentHint).toBe(true)
      expect(byName.delete_comment?.destructiveHint).toBe(true)
      expect(byName.get_workspace?.readOnlyHint).toBe(true)
      expect(byName.list_sprint_tasks?.readOnlyHint).toBe(true)
      expect(byName.plan_sprint_tasks?.idempotentHint).toBe(true)
      expect(byName.update_sprint_duration?.idempotentHint).toBe(true)
      expect(byName.remove_workspace_member?.destructiveHint).toBe(true)
      expect(byName.delete_workspace?.destructiveHint).toBe(true)
      expect(byName.end_sprint?.destructiveHint).toBe(true)
    } finally {
      await client.close()
      await server.close()
    }
  })

  test("advertises the package version", async () => {
    const { server, client } = await connect(fakeApi())
    try {
      expect(client.getServerVersion()).toMatchObject({
        name: "neram",
        version: packageVersion(),
      })
    } finally {
      await client.close()
      await server.close()
    }
  })

  test("returns tool failures as isError results with code and details", async () => {
    // Both projects contain "agent" with no exact match, so the ref is ambiguous.
    const { server, client } = await connect(fakeApi())
    try {
      const result = await client.callTool({
        name: "summarize_project",
        arguments: { project: "agent" },
      })
      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0]
        .text
      const payload = JSON.parse(text) as {
        error: { code: string; details?: { matches?: unknown[] } }
      }
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
      const result = await client.callTool({
        name: "create_project",
        arguments: { name: "Launch" },
      })
      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0]
        .text
      expect(JSON.parse(text)).toMatchObject({
        error: { code: "FORBIDDEN", message: "Nope." },
      })
    } finally {
      await client.close()
      await server.close()
    }
  })

  test("starts and lists tools without auth; auth failure is an isError result", async () => {
    // Regression: `neram mcp` used to exit before the handshake when no
    // session existed, so MCP clients saw a closed connection and parked the
    // server. Auth must be deferred to tool-call time so the server always
    // serves a healthy JSON-RPC peer.
    const api = createConvexApi("https://example.invalid", () => {
      throw new AgentError("UNAUTHENTICATED", "Run `neram login` first.")
    })
    const { server, client } = await connect(api)
    try {
      // initialize + tools/list succeed without ever touching auth.
      const { tools } = await client.listTools()
      expect(tools.length).toBeGreaterThan(0)

      // The first real call surfaces UNAUTHENTICATED as an isError result.
      const result = await client.callTool({
        name: "list_projects",
        arguments: {},
      })
      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0]
        .text
      expect(JSON.parse(text)).toMatchObject({
        error: { code: "UNAUTHENTICATED" },
      })
    } finally {
      await client.close()
      await server.close()
    }
  })

  test("exposes resources, prompts, and output schemas", async () => {
    const { server, client } = await connect(fakeApi())
    try {
      const { resources } = await client.listResources()
      expect(resources.map((r) => r.uri)).toEqual(
        expect.arrayContaining([
          "neram://workspace/status",
          "neram://sprint/current",
          "neram://projects",
          "neram://brief/daily",
        ])
      )
      const { resourceTemplates } = await client.listResourceTemplates()
      expect(resourceTemplates.map((t) => t.uriTemplate)).toEqual(
        expect.arrayContaining(["neram://project/{id}", "neram://task/{id}"])
      )
      const { prompts } = await client.listPrompts()
      expect(prompts.map((p) => p.name)).toEqual(
        expect.arrayContaining([
          "plan-sprint",
          "daily-standup",
          "project-retro",
          "triage-capture",
        ])
      )
      const { tools } = await client.listTools()
      const byName = Object.fromEntries(tools.map((t) => [t.name, t]))
      expect(byName.daily_brief.outputSchema).toBeDefined()
      expect(byName.list_projects.outputSchema).toBeDefined()
      expect(byName.get_task.outputSchema).toBeDefined()
    } finally {
      await client.close()
      await server.close()
    }
  })

  test("mcp list surfaces resource templates in both output formats", async () => {
    // Runs the real `neram mcp list` aggregation (buildMcpList, shared with
    // cli.ts) against an in-memory server, checking the JSON payload and the
    // human text so either format regressing fails this test.
    const { buildMcpList } = await import("../src/mcp-list.js")
    const { server, client } = await connect(fakeApi())
    try {
      const { payload, human } = await buildMcpList(client)
      expect(payload.tools.length).toBeGreaterThan(0)
      expect(payload.resources).toEqual(
        expect.arrayContaining(["neram://projects"])
      )
      expect(payload.resourceTemplates).toEqual(
        expect.arrayContaining(["neram://project/{id}", "neram://task/{id}"])
      )
      expect(payload.prompts).toEqual(
        expect.arrayContaining(["plan-sprint"])
      )
      expect(human).toContain("Resource templates: neram://project/{id}")
    } finally {
      await client.close()
      await server.close()
    }
  })

  test("reads a static resource without auth-gated tools/list failing", async () => {
    const { server, client } = await connect(fakeApi())
    try {
      const result = await client.readResource({
        uri: "neram://projects",
      })
      expect(result.contents.length).toBeGreaterThan(0)
    } finally {
      await client.close()
      await server.close()
    }
  })

  test("rejects header/body mismatches, including batches, as JSON-RPC errors", async () => {
    const { handleFetchMcp } = await import("../src/mcp.js")
    const api = fakeApi()
    const batch = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "daily_brief", arguments: {} },
      },
    ]
    const mismatched = new Request("https://mcp.test/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "mcp-method": "tools/call",
        "mcp-name": "workspace_status",
      },
      body: JSON.stringify(batch),
    })
    const rejected = await handleFetchMcp(mismatched, api)
    expect(rejected.status).toBe(400)
    const payload = (await rejected.json()) as Array<{
      jsonrpc: string
      id: number
      error: { code: number }
    }>
    expect(payload).toHaveLength(1)
    expect(payload[0]).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32000 },
    })

    const matched = new Request("https://mcp.test/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-method": "tools/call",
        "mcp-name": "workspace_status",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "workspace_status", arguments: {} },
      }),
    })
    // Matching headers pass validation and reach the tool (which returns an
    // isError-shaped result body, not a transport rejection).
    const passed = await handleFetchMcp(matched, api)
    expect(passed.status).toBe(200)
  })

  test("acks well-formed notification-only batches without a body", async () => {
    const { handleFetchMcp } = await import("../src/mcp.js")
    const api = fakeApi()
    // Mismatched routing headers on a well-formed notification batch take
    // the empty 202 path (there is no id to correlate an error with).
    const notifications = new Request("https://mcp.test/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-method": "tools/call",
        "mcp-name": "workspace_status",
      },
      body: JSON.stringify([
        { jsonrpc: "2.0", method: "notifications/initialized" },
      ]),
    })
    const acked = await handleFetchMcp(notifications, api)
    // Per JSON-RPC, notifications receive no response: 202 with empty body.
    expect(acked.status).toBe(202)
    expect(await acked.text()).toBe("")
  })

  test("rejects malformed id-less bodies instead of acking them", async () => {
    const { handleFetchMcp } = await import("../src/mcp.js")
    const api = fakeApi()
    const malformed = new Request("https://mcp.test/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "mcp-method": "tools/call",
        "mcp-name": "header-target",
      },
      body: JSON.stringify({ params: { name: "body-target" } }),
    })
    const rejected = await handleFetchMcp(malformed, api)
    expect(rejected.status).toBe(400)
    const payload = (await rejected.json()) as {
      jsonrpc: string
      id: null
      error: { code: number }
    }
    expect(payload).toMatchObject({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000 },
    })
  })
})
