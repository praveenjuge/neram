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
  "Workspace member removal, workspace deletion, and early Sprint rollover require the exact Organization id and slug plus confirm=true.",
  "OAuth tokens are bound to one Clerk Organization; reconnect after switching workspaces.",
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

  register("daily_brief", "Daily Brief", "Compact daily execution digest with open work, assigned tasks, recent activity, and next actions.", schemas.daily_brief, readOnly, (input) => tools.daily_brief(schemas.daily_brief.parse(input)))
  register("workspace_status", "Workspace Status", "Return the caller's Neram identity and workspace totals: visible projects, owned/shared split, and open task count.", schemas.workspace_status, readOnly, (input) => tools.workspace_status(schemas.workspace_status.parse(input)))
  register("list_projects", "List Projects", "List every project the caller can see with role and task counts, most recently updated first.", schemas.list_projects, readOnly, (input) => tools.list_projects(schemas.list_projects.parse(input)))
  register("list_tasks", "List Tasks", "List a project's tasks (resolved by id or unambiguous name), optionally filtered by status.", schemas.list_tasks, readOnly, (input) => tools.list_tasks(schemas.list_tasks.parse(input)))
  register("get_task", "Get Task", "Get one authorized task by its stable id, including subtask progress and active comment count.", schemas.get_task, readOnly, (input) => tools.get_task(schemas.get_task.parse(input)))
  register("list_project_members", "List Project Members", "List stable member subjects and display labels for assignment and structured mentions.", schemas.list_project_members, readOnly, (input) => tools.list_project_members(schemas.list_project_members.parse(input)))
  register("list_subtasks", "List Subtasks", "List a task's subtasks in canonical manual order.", schemas.list_subtasks, readOnly, (input) => tools.list_subtasks(schemas.list_subtasks.parse(input)))
  register("list_task_comments", "List Task Comments", "Page root comments or one direct-reply branch oldest first.", schemas.list_task_comments, readOnly, (input) => tools.list_task_comments(schemas.list_task_comments.parse(input)))
  register("summarize_project", "Summarize Project", "Return compact project, task, and count context for an LLM.", schemas.summarize_project, readOnly, (input) => tools.summarize_project(schemas.summarize_project.parse(input)))
  register("recent_activity", "Recent Activity", "Return the caller's recent activity feed across every accessible project, newest first.", schemas.recent_activity, readOnly, (input) => tools.recent_activity(schemas.recent_activity.parse(input)))
  register("get_workspace", "Get Workspace", "Return the Clerk Organization bound to the current OAuth token, projected membership, and Sprint settings.", schemas.get_workspace, readOnly, (input) => tools.get_workspace(schemas.get_workspace.parse(input)))
  register("list_workspace_members", "List Workspace Members", "List the active Organization's projected members and roles.", schemas.list_workspace_members, readOnly, (input) => tools.list_workspace_members(schemas.list_workspace_members.parse(input)))
  register("get_sprint", "Get Sprint", "Return Current or Upcoming Sprint dates, goal, summary counts, and task count.", schemas.get_sprint, readOnly, (input) => tools.get_sprint(schemas.get_sprint.parse(input)))
  register("list_sprint_tasks", "List Sprint Tasks", "List Backlog, Current, or Upcoming work with project and child-count context.", schemas.list_sprint_tasks, readOnly, (input) => tools.list_sprint_tasks(schemas.list_sprint_tasks.parse(input)))
  register("sprint_history", "Sprint History", "Page closed Sprints or inspect the append-only task audit for an explicit Sprint id.", schemas.sprint_history, readOnly, (input) => tools.sprint_history(schemas.sprint_history.parse(input)))

  register("capture_task", "Capture Task", "Create a task in a project resolved by id or unambiguous name. Defaults to Backlog unless sprint is explicit.", schemas.capture_task, creates, (input) => tools.capture_task(schemas.capture_task.parse(input)), outputSchemas.capture_task)
  register("update_task", "Update Task", "Edit a task's title, description, or due date, or clear its assignee. Address it by id, or by unambiguous project and title.", schemas.update_task, idempotent, (input) => tools.update_task(schemas.update_task.parse(input)), outputSchemas.update_task)
  register("move_task", "Move Task", "Move or reorder a task by id, or by unambiguous project and title.", schemas.move_task, idempotent, (input) => tools.move_task(schemas.move_task.parse(input)), outputSchemas.move_task)
  register("complete_task", "Complete Task", "Mark a task done by id, or by unambiguous project and title.", schemas.complete_task, idempotent, (input) => tools.complete_task(schemas.complete_task.parse(input)), outputSchemas.complete_task)
  register("move_task_to_project", "Move Task To Project", "Move a task to another project the caller can access, resolving both ends by id or unambiguous name.", schemas.move_task_to_project, idempotent, (input) => tools.move_task_to_project(schemas.move_task_to_project.parse(input)), outputSchemas.move_task_to_project)
  register("delete_task", "Delete Task", "Permanently delete a task by id, or by unambiguous project and title. Children require confirmCascade.", schemas.delete_task, destructive, (input) => tools.delete_task(schemas.delete_task.parse(input)), outputSchemas.delete_task)
  register("create_subtask", "Create Subtask", "Append a one-level subtask to a task.", schemas.create_subtask, creates, (input) => tools.create_subtask(schemas.create_subtask.parse(input)), outputSchemas.create_subtask)
  register("rename_subtask", "Rename Subtask", "Rename a subtask.", schemas.rename_subtask, idempotent, (input) => tools.rename_subtask(schemas.rename_subtask.parse(input)), outputSchemas.rename_subtask)
  register("set_subtask_completed", "Set Subtask Completed", "Complete or reopen a subtask.", schemas.set_subtask_completed, idempotent, (input) => tools.set_subtask_completed(schemas.set_subtask_completed.parse(input)), outputSchemas.set_subtask_completed)
  register("reorder_subtask", "Reorder Subtask", "Move a subtask immediately before or after another subtask on the same task.", schemas.reorder_subtask, idempotent, (input) => tools.reorder_subtask(schemas.reorder_subtask.parse(input)), outputSchemas.reorder_subtask)
  register("delete_subtask", "Delete Subtask", "Permanently delete a subtask.", schemas.delete_subtask, destructive, (input) => tools.delete_subtask(schemas.delete_subtask.parse(input)), outputSchemas.delete_subtask)
  register("create_comment", "Create Comment", "Post a root task comment from ordered text and structured mention segments.", schemas.create_comment, creates, (input) => tools.create_comment(schemas.create_comment.parse(input)), outputSchemas.create_comment)
  register("reply_to_comment", "Reply To Comment", "Post a direct reply from ordered text and structured mention segments.", schemas.reply_to_comment, creates, (input) => tools.reply_to_comment(schemas.reply_to_comment.parse(input)), outputSchemas.reply_to_comment)
  register("edit_comment", "Edit Comment", "Edit the caller's comment using ordered text and structured mention segments.", schemas.edit_comment, idempotent, (input) => tools.edit_comment(schemas.edit_comment.parse(input)), outputSchemas.edit_comment)
  register("delete_comment", "Delete Comment", "Tombstone a comment while preserving its descendants.", schemas.delete_comment, destructive, (input) => tools.delete_comment(schemas.delete_comment.parse(input)), outputSchemas.delete_comment)
  register("create_project", "Create Project", "Create a new project owned by the caller.", schemas.create_project, creates, (input) => tools.create_project(schemas.create_project.parse(input)), outputSchemas.create_project)
  register("update_project", "Update Project", "Update a project's name, icon, or color. Address it by id or unambiguous name.", schemas.update_project, idempotent, (input) => tools.update_project(schemas.update_project.parse(input)), outputSchemas.update_project)
  register("delete_project", "Delete Project", "Permanently delete a project and all of its tasks. Requires an explicit projectId.", schemas.delete_project, destructive, (input) => tools.delete_project(schemas.delete_project.parse(input)), outputSchemas.delete_project)
  register("create_workspace", "Create Workspace", "Create a Clerk Organization. Reauthorization is required before using the new workspace.", schemas.create_workspace, creates, (input) => tools.create_workspace(schemas.create_workspace.parse(input)), outputSchemas.create_workspace)
  register("invite_workspace_member", "Invite Workspace Member", "Invite an email address to the active Organization with an explicit role.", schemas.invite_workspace_member, creates, (input) => tools.invite_workspace_member(schemas.invite_workspace_member.parse(input)), outputSchemas.invite_workspace_member)
  register("update_workspace_member_role", "Update Workspace Member Role", "Set an Organization member's role.", schemas.update_workspace_member_role, idempotent, (input) => tools.update_workspace_member_role(schemas.update_workspace_member_role.parse(input)), outputSchemas.update_workspace_member_role)
  register("remove_workspace_member", "Remove Workspace Member", "Remove a member and asynchronously unassign their open tasks. Requires exact Organization confirmation.", schemas.remove_workspace_member, destructive, (input) => tools.remove_workspace_member(schemas.remove_workspace_member.parse(input)), outputSchemas.remove_workspace_member)
  register("delete_workspace", "Delete Workspace", "Purge Organization-scoped Neram data in resumable batches, then delete Clerk last. Requires exact Organization confirmation.", schemas.delete_workspace, destructive, (input) => tools.delete_workspace(schemas.delete_workspace.parse(input)), outputSchemas.delete_workspace)
  register("plan_sprint_tasks", "Plan Sprint Tasks", "Move one or more tasks into Backlog, Current, or Upcoming while preserving Sprint audit truth.", schemas.plan_sprint_tasks, idempotent, (input) => tools.plan_sprint_tasks(schemas.plan_sprint_tasks.parse(input)), outputSchemas.plan_sprint_tasks)
  register("remove_sprint_tasks", "Remove Sprint Tasks", "Return Current or Upcoming tasks to Backlog; active work also returns to Todo.", schemas.remove_sprint_tasks, idempotent, (input) => tools.remove_sprint_tasks(schemas.remove_sprint_tasks.parse(input)), outputSchemas.remove_sprint_tasks)
  register("update_sprint_goal", "Update Sprint Goal", "Set or clear the Current or Upcoming Sprint goal.", schemas.update_sprint_goal, idempotent, (input) => tools.update_sprint_goal(schemas.update_sprint_goal.parse(input)), outputSchemas.update_sprint_goal)
  register("update_sprint_cadence", "Update Sprint Cadence", "Set 1-8 week cadence, start weekday, and IANA timezone for the following Sprint.", schemas.update_sprint_cadence, idempotent, (input) => tools.update_sprint_cadence(schemas.update_sprint_cadence.parse(input)), outputSchemas.update_sprint_cadence)
  register("rollover_sprint", "Rollover Sprint", "Irreversibly close Current early with an audited reason and carry unfinished work forward. Requires exact Organization confirmation.", schemas.rollover_sprint, destructive, (input) => tools.rollover_sprint(schemas.rollover_sprint.parse(input)), outputSchemas.rollover_sprint)

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
