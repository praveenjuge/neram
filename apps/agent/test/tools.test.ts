import { describe, expect, test, vi } from "vitest"

import { AgentError, createTools, type NeramApi } from "../src/agent.js"

function fakeApi(): NeramApi {
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
    activity: vi.fn(async () => []),
    createTask: vi.fn(async () => "tc"),
    moveTask: vi.fn(async () => undefined),
    checkIn: vi.fn(async () => 123),
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
})
