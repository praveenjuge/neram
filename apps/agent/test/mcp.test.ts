import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { describe, expect, test, vi } from "vitest"

import { AgentError, type NeramApi } from "../src/agent.js"
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
    currentWorkspace: vi.fn(async () => ({
      organization,
      membership,
      settings: {
        cadenceWeeks: 2,
        startWeekday: 1,
        timezone: "UTC",
        nextSprintNumber: 3,
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
    upcomingSprint: vi.fn(async () => null),
    backlogTasks: vi.fn(async () => []),
    sprintHistory: vi.fn(async () => ({
      page: [],
      isDone: true,
      continueCursor: "",
    })),
    sprintAudit: vi.fn(async () => ({
      page: [],
      isDone: true,
      continueCursor: "",
    })),
    planSprintTasks: vi.fn(async () => undefined),
    removeSprintTasks: vi.fn(async () => undefined),
    updateSprintGoal: vi.fn(async () => undefined),
    updateSprintCadence: vi.fn(async () => undefined),
    rolloverSprint: vi.fn(async () => "job_rollover"),
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
          "update_sprint_cadence",
          "rollover_sprint",
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
      expect(byName.update_sprint_cadence?.idempotentHint).toBe(true)
      expect(byName.remove_workspace_member?.destructiveHint).toBe(true)
      expect(byName.delete_workspace?.destructiveHint).toBe(true)
      expect(byName.rollover_sprint?.destructiveHint).toBe(true)
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
})
