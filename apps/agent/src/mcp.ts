import type { IncomingMessage, ServerResponse } from "node:http"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import type { AnySchema, ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js"

import { createTools, schemas, toAgentError, type NeramApi } from "./agent.js"

type JsonObject = Record<string, unknown>

function result(output: JsonObject) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
    structuredContent: output,
  }
}

export function createNeramMcpServer(client: NeramApi) {
  const server = new McpServer({ name: "neram", version: "0.1.0" })
  const tools = createTools(client)
  const raw = (schema: { shape: Record<string, unknown> }) =>
    schema.shape as Record<string, AnySchema> as ZodRawShapeCompat
  const register = (
    name: string,
    title: string,
    description: string,
    schema: { shape: Record<string, unknown> },
    run: (input: unknown) => Promise<JsonObject>
  ) => server.registerTool(name, {
    title,
    description,
    inputSchema: raw(schema),
  }, async (input) => result(await run(input)))

  register("daily_brief", "Daily Brief", "Compact daily execution digest with open work, stale projects, recent activity, and next actions.", schemas.daily_brief, (input) => tools.daily_brief(schemas.daily_brief.parse(input)))
  register("capture_task", "Capture Task", "Create a task in a project resolved by id or unambiguous name.", schemas.capture_task, (input) => tools.capture_task(schemas.capture_task.parse(input)))
  register("move_task", "Move Task", "Move or reorder a task by id, or by unambiguous project and title.", schemas.move_task, (input) => tools.move_task(schemas.move_task.parse(input)))
  register("complete_task", "Complete Task", "Mark a task done by id, or by unambiguous project and title.", schemas.complete_task, (input) => tools.complete_task(schemas.complete_task.parse(input)))
  register("check_in_project", "Check In Project", "Update the caller's personal recency/check-in marker for a project.", schemas.check_in_project, (input) => tools.check_in_project(schemas.check_in_project.parse(input)))
  register("summarize_project", "Summarize Project", "Return compact project, task, and count context for an LLM.", schemas.summarize_project, (input) => tools.summarize_project(schemas.summarize_project.parse(input)))
  register("workspace_status", "Workspace Status", "Return the caller's Neram identity and workspace totals: visible projects, owned/shared split, and open task count.", schemas.workspace_status, (input) => tools.workspace_status(schemas.workspace_status.parse(input)))
  server.server.onerror = (error) => {
    console.error(toAgentError(error).message)
  }
  return server
}

export async function runStdioMcp(client: NeramApi) {
  const server = createNeramMcpServer(client)
  await server.connect(new StdioServerTransport())
}

export async function handleHttpMcp(req: IncomingMessage & { body?: unknown }, res: ServerResponse, client: NeramApi) {
  if (req.method !== "POST") {
    res.writeHead(405, { "content-type": "application/json" })
    res.end(JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST for MCP Streamable HTTP." } }))
    return
  }
  const server = createNeramMcpServer(client)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (error) {
    if (!res.headersSent) {
      const err = toAgentError(error)
      res.writeHead(500, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: { code: err.code, message: err.message } }))
    }
  } finally {
    await transport.close()
    await server.close()
  }
}

export async function handleFetchMcp(request: Request, client: NeramApi): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      { error: { code: "METHOD_NOT_ALLOWED", message: "Use POST for MCP Streamable HTTP." } },
      { status: 405 }
    )
  }

  const server = createNeramMcpServer(client)
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  })

  try {
    await server.connect(transport)
    return await transport.handleRequest(request)
  } catch (error) {
    const err = toAgentError(error)
    return Response.json(
      { error: { code: err.code, message: err.message } },
      { status: 500 }
    )
  } finally {
    await transport.close()
    await server.close()
  }
}
