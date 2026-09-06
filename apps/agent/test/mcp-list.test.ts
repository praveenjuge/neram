import { describe, expect, test } from "vitest"

import { buildMcpList, type McpLister } from "../src/mcp-list.js"

function fakeLister(overrides: Partial<McpLister> = {}): McpLister {
  return {
    listTools: async () => ({ tools: [{ name: "workspace_status" }] }),
    listResources: async () => ({ resources: [{ uri: "neram://projects" }] }),
    listResourceTemplates: async () => ({
      resourceTemplates: [{ uriTemplate: "neram://project/{id}" }],
    }),
    listPrompts: async () => ({ prompts: [{ name: "plan-sprint" }] }),
    ...overrides,
  }
}

describe("buildMcpList", () => {
  test("emits tools, resources, templates, and prompts in both formats", async () => {
    const { payload, human } = await buildMcpList(fakeLister())
    expect(payload).toEqual({
      tools: ["workspace_status"],
      resources: ["neram://projects"],
      resourceTemplates: ["neram://project/{id}"],
      prompts: ["plan-sprint"],
    })
    expect(human).toContain("workspace_status")
    expect(human).toContain("Resources: neram://projects")
    expect(human).toContain("Resource templates: neram://project/{id}")
    expect(human).toContain("Prompts: plan-sprint")
  })

  test("degrades to empty lists when a discovery call fails", async () => {
    const { payload, human } = await buildMcpList(
      fakeLister({
        listResources: async () => {
          throw new Error("boom")
        },
        listResourceTemplates: async () => {
          throw new Error("boom")
        },
        listPrompts: async () => {
          throw new Error("boom")
        },
      })
    )
    expect(payload).toEqual({
      tools: ["workspace_status"],
      resources: [],
      resourceTemplates: [],
      prompts: [],
    })
    expect(human).toContain("Resource templates: ")
  })
})
