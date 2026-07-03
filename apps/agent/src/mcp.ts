import type { IncomingMessage, ServerResponse } from "node:http"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js"
import type { AnySchema, ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js"

import { createTools, outputSchemas, schemas, toAgentError, type NeramApi } from "./agent.js"
import { packageVersion } from "./version.js"

type JsonObject = Record<string, unknown>
type Shape = { shape: Record<string, unknown> }

// Short guidance surfaced to the calling agent alongside the tool list.
const INSTRUCTIONS = [
  "Neram workspace tools for AI agents.",
  "Resolve a project or task by its id whenever you know it; otherwise pass an unambiguous name.",
  "When a name matches more than one record the tool returns an AMBIGUOUS error whose details.matches lists the candidates — retry with one of those ids.",
  "Tool failures come back as isError results carrying { error: { code, message, details } } rather than protocol exceptions.",
  "delete_project purges every task in the project and requires an explicit projectId.",
].join(" ")

// MCP tool annotations. readOnly tools never mutate; the write tools flag
// whether repeating the call is safe (idempotent) or removes data (destructive).
const readOnly: ToolAnnotations = { readOnlyHint: true }
const creates: ToolAnnotations = { readOnlyHint: false }
const idempotent: ToolAnnotations = { readOnlyHint: false, idempotentHint: true }
const destructive: ToolAnnotations = { readOnlyHint: false, destructiveHint: true }

function result(output: JsonObject) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
    structuredContent: output,
  }
}

export function createNeramMcpServer(client: NeramApi) {
  const server = new McpServer(
    { name: "neram", version: packageVersion() },
    { instructions: INSTRUCTIONS }
  )
  const tools = createTools(client)
  const raw = (schema: Shape) =>
    schema.shape as Record<string, AnySchema> as ZodRawShapeCompat
  const register = (
    name: string,
    title: string,
    description: string,
    schema: Shape,
    annotations: ToolAnnotations,
    run: (input: unknown) => Promise<JsonObject>,
    outputSchema?: Shape
  ) => server.registerTool(name, {
    title,
    description,
    inputSchema: raw(schema),
    annotations,
    ...(outputSchema ? { outputSchema: raw(outputSchema) } : {}),
  }, async (input) => {
    // Surface tool errors as MCP results so the agent sees stable codes and the
    // AMBIGUOUS candidate list, instead of a protocol-level exception.
    try {
      return result(await run(input))
    } catch (error) {
      const err = toAgentError(error)
      return {
        isError: true,
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: { code: err.code, message: err.message, details: err.details } }),
        }],
      }
    }
  })

  register("daily_brief", "Daily Brief", "Compact daily execution digest with open work, stale projects, recent activity, and next actions.", schemas.daily_brief, readOnly, (input) => tools.daily_brief(schemas.daily_brief.parse(input)))
  register("workspace_status", "Workspace Status", "Return the caller's Neram identity and workspace totals: visible projects, owned/shared split, and open task count.", schemas.workspace_status, readOnly, (input) => tools.workspace_status(schemas.workspace_status.parse(input)))
  register("list_projects", "List Projects", "List every project the caller can see with role, task count, and recency.", schemas.list_projects, readOnly, (input) => tools.list_projects(schemas.list_projects.parse(input)))
  register("list_tasks", "List Tasks", "List a project's tasks (resolved by id or unambiguous name), optionally filtered by status.", schemas.list_tasks, readOnly, (input) => tools.list_tasks(schemas.list_tasks.parse(input)))
  register("summarize_project", "Summarize Project", "Return compact project, task, and count context for an LLM.", schemas.summarize_project, readOnly, (input) => tools.summarize_project(schemas.summarize_project.parse(input)))
  register("recent_activity", "Recent Activity", "Return the caller's recent activity feed across every accessible project, newest first.", schemas.recent_activity, readOnly, (input) => tools.recent_activity(schemas.recent_activity.parse(input)))

  register("capture_task", "Capture Task", "Create a task in a project resolved by id or unambiguous name.", schemas.capture_task, creates, (input) => tools.capture_task(schemas.capture_task.parse(input)), outputSchemas.capture_task)
  register("update_task", "Update Task", "Edit a task's title, description, or due date, or clear its assignee. Address it by id, or by unambiguous project and title.", schemas.update_task, idempotent, (input) => tools.update_task(schemas.update_task.parse(input)), outputSchemas.update_task)
  register("move_task", "Move Task", "Move or reorder a task by id, or by unambiguous project and title.", schemas.move_task, idempotent, (input) => tools.move_task(schemas.move_task.parse(input)), outputSchemas.move_task)
  register("complete_task", "Complete Task", "Mark a task done by id, or by unambiguous project and title.", schemas.complete_task, idempotent, (input) => tools.complete_task(schemas.complete_task.parse(input)), outputSchemas.complete_task)
  register("move_task_to_project", "Move Task To Project", "Move a task to another project the caller can access, resolving both ends by id or unambiguous name.", schemas.move_task_to_project, idempotent, (input) => tools.move_task_to_project(schemas.move_task_to_project.parse(input)), outputSchemas.move_task_to_project)
  register("delete_task", "Delete Task", "Permanently delete a task by id, or by unambiguous project and title.", schemas.delete_task, destructive, (input) => tools.delete_task(schemas.delete_task.parse(input)), outputSchemas.delete_task)
  register("check_in_project", "Check In Project", "Update the caller's personal recency/check-in marker for a project.", schemas.check_in_project, idempotent, (input) => tools.check_in_project(schemas.check_in_project.parse(input)), outputSchemas.check_in_project)
  register("create_project", "Create Project", "Create a new project owned by the caller.", schemas.create_project, creates, (input) => tools.create_project(schemas.create_project.parse(input)), outputSchemas.create_project)
  register("update_project", "Update Project", "Update a project's name, icon, or color. Address it by id or unambiguous name.", schemas.update_project, idempotent, (input) => tools.update_project(schemas.update_project.parse(input)), outputSchemas.update_project)
  register("delete_project", "Delete Project", "Permanently delete a project and all of its tasks. Requires an explicit projectId.", schemas.delete_project, destructive, (input) => tools.delete_project(schemas.delete_project.parse(input)), outputSchemas.delete_project)

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
