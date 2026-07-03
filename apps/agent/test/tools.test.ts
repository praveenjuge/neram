import { describe, expect, test, vi } from "vitest"

import { AgentError, createTools, type NeramApi } from "../src/agent.js"

function fakeApi(overrides: Partial<NeramApi> = {}): NeramApi {
  const tasks = [
    { _id: "ta", projectId: "pa", title: "Ship CLI", status: "todo" as const, updatedAt: 1 },
    { _id: "tb", projectId: "pa", title: "Ship docs", status: "inProgress" as const, updatedAt: 2 },
  ]
  return {
    projects: vi.fn(async () => [
      { _id: "pa", name: "Agent", role: "owner" as const, taskCount: 2, todoCount: 1, inProgressCount: 1, doneCount: 0, updatedAt: 1 },
      { _id: "pb", name: "Agent Ops", role: "owner" as const, taskCount: 0, todoCount: 0, inProgressCount: 0, doneCount: 0, updatedAt: 1 },
    ]),
    tasks: vi.fn(async () => tasks),
    assignedTasks: vi.fn(async () => []),
    activity: vi.fn(async () => [
      { type: "task.created", projectName: "Agent", taskTitle: "Ship CLI", actorName: "Ada", createdAt: 5 },
    ]),
    createTask: vi.fn(async () => "tc"),
    updateTask: vi.fn(async () => undefined),
    moveTask: vi.fn(async () => undefined),
    changeTaskProject: vi.fn(async () => undefined),
    removeTask: vi.fn(async () => undefined),
    createProject: vi.fn(async () => "pnew"),
    updateProject: vi.fn(async () => undefined),
    removeProject: vi.fn(async () => undefined),
    checkIn: vi.fn(async () => 123),
    status: vi.fn(async () => ({
      identity: { name: "Ada", email: "ada@example.com" },
      workspace: { projects: 2, ownedProjects: 2, sharedProjects: 0, openTasks: 2 },
    })),
    ...overrides,
  }
}

describe("agent tools", () => {
  test("rejects ambiguous project names", async () => {
    await expect(createTools(fakeApi()).summarize_project({ project: "gent" })).rejects.toBeInstanceOf(AgentError)
  })

  test("creates tasks through the canonical client", async () => {
    const api = fakeApi()
    const output = await createTools(api).capture_task({ projectId: "pa", title: "Review smoke" })
    expect(output).toEqual({ taskId: "tc", projectId: "pa", projectName: "Agent", title: "Review smoke", status: "todo" })
    expect(api.createTask).toHaveBeenCalledWith(expect.objectContaining({ projectId: "pa", title: "Review smoke" }))
  })

  test("moves a uniquely resolved task", async () => {
    const api = fakeApi()
    await expect(createTools(api).move_task({ projectId: "pa", taskTitle: "CLI", status: "done" })).resolves.toEqual({
      taskId: "ta",
      status: "done",
    })
    expect(api.moveTask).toHaveBeenCalledWith({ taskId: "ta", status: "done", position: undefined })
  })

  test("workspace_status returns the canonical status payload", async () => {
    const api = fakeApi()
    await expect(createTools(api).workspace_status({})).resolves.toEqual({
      identity: { name: "Ada", email: "ada@example.com" },
      workspace: { projects: 2, ownedProjects: 2, sharedProjects: 0, openTasks: 2 },
    })
    expect(api.status).toHaveBeenCalledOnce()
  })

  test("workspace_status tolerates a missing argument object", async () => {
    const api = fakeApi()
    await expect(createTools(api).workspace_status()).resolves.toMatchObject({
      workspace: { projects: 2 },
    })
  })
})

describe("read-only listing tools", () => {
  test("list_projects returns compact projects", async () => {
    const output = await createTools(fakeApi()).list_projects({})
    expect(output.projects).toHaveLength(2)
    expect(output.projects[0]).toMatchObject({ projectId: "pa", name: "Agent", role: "owner", taskCount: 2, openTasks: 2 })
  })

  test("list_tasks resolves a project and filters by status", async () => {
    const all = await createTools(fakeApi()).list_tasks({ projectId: "pa" })
    expect(all.project.projectId).toBe("pa")
    expect(all.tasks).toHaveLength(2)

    const todos = await createTools(fakeApi()).list_tasks({ projectId: "pa", status: "todo" })
    expect(todos.tasks).toHaveLength(1)
    expect(todos.tasks[0]).toMatchObject({ taskId: "ta", status: "todo" })
  })

  test("recent_activity maps compact activity with a default limit", async () => {
    const api = fakeApi()
    const output = await createTools(api).recent_activity({})
    expect(api.activity).toHaveBeenCalledWith(12)
    expect(output.activity[0]).toMatchObject({ type: "task.created", projectName: "Agent", actorName: "Ada" })
  })
})

describe("task mutation tools", () => {
  test("update_task resolves a task and edits fields", async () => {
    const api = fakeApi()
    const output = await createTools(api).update_task({ projectId: "pa", taskTitle: "Ship CLI", title: "Ship the CLI" })
    expect(output).toEqual({ taskId: "ta" })
    expect(api.updateTask).toHaveBeenCalledWith({
      taskId: "ta",
      title: "Ship the CLI",
      description: undefined,
      dueDate: undefined,
    })
  })

  test("update_task clears the assignee with an empty subject", async () => {
    const api = fakeApi()
    await createTools(api).update_task({ taskId: "ta", clearAssignee: true })
    expect(api.updateTask).toHaveBeenCalledWith(expect.objectContaining({ taskId: "ta", assigneeSubject: "" }))
  })

  test("delete_task removes a resolved task", async () => {
    const api = fakeApi()
    const output = await createTools(api).delete_task({ taskId: "ta" })
    expect(output).toEqual({ taskId: "ta", deleted: true })
    expect(api.removeTask).toHaveBeenCalledWith("ta")
  })

  test("move_task_to_project resolves both ends", async () => {
    const api = fakeApi()
    const output = await createTools(api).move_task_to_project({ taskId: "ta", toProjectId: "pb" })
    expect(output).toEqual({ taskId: "ta", projectId: "pb", projectName: "Agent Ops" })
    expect(api.changeTaskProject).toHaveBeenCalledWith({ taskId: "ta", projectId: "pb" })
  })

  test("move_task_to_project resolves the destination by name", async () => {
    const api = fakeApi()
    await createTools(api).move_task_to_project({ taskId: "ta", toProject: "Agent Ops" })
    expect(api.changeTaskProject).toHaveBeenCalledWith({ taskId: "ta", projectId: "pb" })
  })
})

describe("project mutation tools", () => {
  test("create_project forwards name, icon, and color", async () => {
    const api = fakeApi()
    const output = await createTools(api).create_project({ name: "Launch", icon: "rocket", color: "blue" })
    expect(output).toEqual({ projectId: "pnew", name: "Launch" })
    expect(api.createProject).toHaveBeenCalledWith({ name: "Launch", icon: "rocket", color: "blue" })
  })

  test("update_project resolves the project then patches it", async () => {
    const api = fakeApi()
    const output = await createTools(api).update_project({ projectId: "pa", name: "Renamed" })
    expect(output).toEqual({ projectId: "pa" })
    expect(api.updateProject).toHaveBeenCalledWith({ projectId: "pa", name: "Renamed", icon: undefined, color: undefined })
  })

  test("delete_project removes by explicit id", async () => {
    const api = fakeApi()
    const output = await createTools(api).delete_project({ projectId: "pa" })
    expect(output).toEqual({ projectId: "pa", deleted: true })
    expect(api.removeProject).toHaveBeenCalledWith("pa")
  })

  test("delete_project rejects a name-only reference", async () => {
    const api = fakeApi()
    // No projectId: the schema requires an explicit id since deletion purges tasks.
    await expect(createTools(api).delete_project({ project: "Agent" } as never)).rejects.toBeDefined()
    expect(api.removeProject).not.toHaveBeenCalled()
  })
})
