/** Shared `neram mcp list` aggregation so the CLI action is unit-testable.
 * Extracted from cli.ts: the action only wires auth/transport and emits. */

export type McpLister = {
  listTools(): Promise<{ tools: Array<{ name: string }> }>
  listResources(): Promise<{ resources: unknown[] }>
  listResourceTemplates(): Promise<{ resourceTemplates: unknown[] }>
  listPrompts(): Promise<{ prompts: unknown[] }>
}

export type McpListPayload = {
  tools: string[]
  resources: string[]
  resourceTemplates: string[]
  prompts: string[]
}

const named = (entry: unknown, keys: string[]): string => {
  const record = entry as Record<string, unknown>
  for (const key of keys) {
    if (typeof record[key] === "string") return record[key] as string
  }
  return String(entry)
}

export async function buildMcpList(
  client: McpLister
): Promise<{ payload: McpListPayload; human: string }> {
  const [{ tools }, { resources }, { resourceTemplates }, { prompts }] =
    await Promise.all([
      client.listTools(),
      client.listResources().catch(() => ({ resources: [] })),
      client.listResourceTemplates().catch(() => ({ resourceTemplates: [] })),
      client.listPrompts().catch(() => ({ prompts: [] })),
    ])
  const payload: McpListPayload = {
    tools: tools.map((t) => t.name),
    resources: (resources as unknown[]).map((r) => named(r, ["uri", "name"])),
    resourceTemplates: (resourceTemplates as unknown[]).map((t) =>
      named(t, ["uriTemplate", "name"])
    ),
    prompts: (prompts as unknown[]).map((p) => named(p, ["name"])),
  }
  const human = [
    ...payload.tools,
    "",
    `Resources: ${payload.resources.join(", ")}`,
    `Resource templates: ${payload.resourceTemplates.join(", ")}`,
    `Prompts: ${payload.prompts.join(", ")}`,
  ].join("\n")
  return { payload, human }
}
