import type { IncomingMessage, ServerResponse } from "node:http"

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod/v3"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js"
import type {
  AnySchema,
  ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js"

import {
  createConvexApi,
  createTools,
  outputSchemas,
  schemas,
  toAgentError,
  type NeramApi,
  type TokenProvider,
} from "./agent.js"
import { packageVersion } from "./version.js"

type JsonObject = Record<string, unknown>
type Shape = { shape: Record<string, unknown> }

// Short guidance surfaced to the calling agent alongside the tool list.
// Aligned with MCP 2026-07-28: stateless, header-routed, cacheable lists.
// Destructive tools confirm via explicit args; when the client supports
// Multi Round-Trip Requests the server may elicit confirmation mid-call
// instead of requiring the flag up front.
const INSTRUCTIONS = [
  "Neram workspace tools for AI agents. Protocol: MCP 2026-07-28 (stateless Streamable HTTP, Mcp-Method/Mcp-Name headers, server/discover).",
  "Resolve a project or task by its id whenever you know it; otherwise pass an unambiguous name.",
  "When a name matches more than one record the tool returns an AMBIGUOUS error whose details.matches lists the candidates — retry with one of those ids. Use completion on project/taskTitle args to discover valid values.",
  "Read-only context is also available as resources (neram://workspace/status, neram://sprint/current, neram://projects, neram://brief/daily) and templates (neram://project/{id}, neram://task/{id}); reusable workflows are exposed as prompts (plan-sprint, daily-standup, project-retro, triage-capture).",
  "Tool failures come back as isError results carrying { error: { code, message, details } } rather than protocol exceptions.",
  "delete_project purges every task in the project and requires an explicit projectId.",
  "Workspace member removal and workspace deletion require the exact Organization id and slug plus confirm=true. Destructive calls (delete_project, delete_workspace, end_sprint, delete_task with children) require their explicit confirm flags; pass them, do not ask the server to confirm mid-call.",
  "OAuth tokens are bound to one Clerk Organization; reconnect after switching workspaces.",
].join(" ")

// MCP tool annotations. readOnly tools never mutate; the write tools flag
// whether repeating the call is safe (idempotent) or removes data (destructive).
const readOnly: ToolAnnotations = { readOnlyHint: true }
const creates: ToolAnnotations = { readOnlyHint: false }
const idempotent: ToolAnnotations = {
  readOnlyHint: false,
  idempotentHint: true,
}
const destructive: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
}

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
  ) =>
    server.registerTool(
      name,
      {
        title,
        description,
        inputSchema: raw(schema),
        annotations,
        ...(outputSchema ? { outputSchema: raw(outputSchema) } : {}),
      },
      async (input) => {
        // Surface tool errors as MCP results so the agent sees stable codes and the
        // AMBIGUOUS candidate list, instead of a protocol-level exception.
        try {
          return result(await run(input))
        } catch (error) {
          const err = toAgentError(error)
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: {
                    code: err.code,
                    message: err.message,
                    details: err.details,
                  },
                }),
              },
            ],
          }
        }
      }
    )

  register(
    "daily_brief",
    "Daily Brief",
    "Compact daily execution digest with open work, assigned tasks, recent activity, and next actions.",
    schemas.daily_brief,
    readOnly,
    (input) => tools.daily_brief(schemas.daily_brief.parse(input)),
    outputSchemas.daily_brief
  )
  register(
    "workspace_status",
    "Workspace Status",
    "Return the caller's Neram identity, active Organization, project count, and open task count.",
    schemas.workspace_status,
    readOnly,
    (input) => tools.workspace_status(schemas.workspace_status.parse(input)),
    outputSchemas.workspace_status
  )
  register(
    "list_projects",
    "List Projects",
    "List every project the caller can see with role and task counts, most recently updated first.",
    schemas.list_projects,
    readOnly,
    (input) => tools.list_projects(schemas.list_projects.parse(input)),
    outputSchemas.list_projects
  )
  register(
    "list_tasks",
    "List Tasks",
    "List a project's tasks (resolved by id or unambiguous name), optionally filtered by status.",
    schemas.list_tasks,
    readOnly,
    (input) => tools.list_tasks(schemas.list_tasks.parse(input)),
    outputSchemas.list_tasks
  )
  register(
    "get_task",
    "Get Task",
    "Get one authorized task by its stable id, including subtask progress and active comment count.",
    schemas.get_task,
    readOnly,
    (input) => tools.get_task(schemas.get_task.parse(input)),
    outputSchemas.get_task
  )
  register(
    "list_subtasks",
    "List Subtasks",
    "List a task's subtasks in canonical manual order.",
    schemas.list_subtasks,
    readOnly,
    (input) => tools.list_subtasks(schemas.list_subtasks.parse(input)),
    outputSchemas.list_subtasks
  )
  register(
    "list_task_comments",
    "List Task Comments",
    "Page root comments or one direct-reply branch oldest first.",
    schemas.list_task_comments,
    readOnly,
    (input) => tools.list_task_comments(schemas.list_task_comments.parse(input)),
    outputSchemas.list_task_comments
  )
  register(
    "summarize_project",
    "Summarize Project",
    "Return compact project, task, and count context for an LLM.",
    schemas.summarize_project,
    readOnly,
    (input) => tools.summarize_project(schemas.summarize_project.parse(input)),
    outputSchemas.summarize_project
  )
  register(
    "recent_activity",
    "Recent Activity",
    "Return the caller's recent activity feed across every accessible project, newest first.",
    schemas.recent_activity,
    readOnly,
    (input) => tools.recent_activity(schemas.recent_activity.parse(input)),
    outputSchemas.recent_activity
  )
  register(
    "get_workspace",
    "Get Workspace",
    "Return the Clerk Organization bound to the current OAuth token, projected membership, and Sprint settings.",
    schemas.get_workspace,
    readOnly,
    (input) => tools.get_workspace(schemas.get_workspace.parse(input)),
    outputSchemas.get_workspace
  )
  register(
    "list_workspace_members",
    "List Workspace Members",
    "List the active Organization's projected members and roles.",
    schemas.list_workspace_members,
    readOnly,
    (input) =>
      tools.list_workspace_members(schemas.list_workspace_members.parse(input)),
    outputSchemas.list_workspace_members
  )
  register(
    "get_sprint",
    "Get Sprint",
    "Return the optional active Sprint dates, goal, simple progress counts, and task count.",
    schemas.get_sprint,
    readOnly,
    (input) => tools.get_sprint(schemas.get_sprint.parse(input)),
    outputSchemas.get_sprint
  )
  register(
    "list_sprint_tasks",
    "List Sprint Tasks",
    "List Backlog or Current Sprint work with project and child-count context.",
    schemas.list_sprint_tasks,
    readOnly,
    (input) => tools.list_sprint_tasks(schemas.list_sprint_tasks.parse(input)),
    outputSchemas.list_sprint_tasks
  )
  register(
    "sprint_history",
    "Sprint History",
    "Page closed Sprints with committed and completed counts.",
    schemas.sprint_history,
    readOnly,
    (input) => tools.sprint_history(schemas.sprint_history.parse(input)),
    outputSchemas.sprint_history
  )

  register(
    "capture_task",
    "Capture Task",
    "Create a task in Backlog for a project resolved by id or unambiguous name.",
    schemas.capture_task,
    creates,
    (input) => tools.capture_task(schemas.capture_task.parse(input)),
    outputSchemas.capture_task
  )
  register(
    "update_task",
    "Update Task",
    "Edit a task's title, description, or due date, or clear its assignee. Address it by id, or by unambiguous project and title.",
    schemas.update_task,
    idempotent,
    (input) => tools.update_task(schemas.update_task.parse(input)),
    outputSchemas.update_task
  )
  register(
    "move_task",
    "Move Task",
    "Move or reorder a task by id, or by unambiguous project and title.",
    schemas.move_task,
    idempotent,
    (input) => tools.move_task(schemas.move_task.parse(input)),
    outputSchemas.move_task
  )
  register(
    "complete_task",
    "Complete Task",
    "Mark a task done by id, or by unambiguous project and title.",
    schemas.complete_task,
    idempotent,
    (input) => tools.complete_task(schemas.complete_task.parse(input)),
    outputSchemas.complete_task
  )
  register(
    "move_task_to_project",
    "Move Task To Project",
    "Move a task to another project the caller can access, resolving both ends by id or unambiguous name.",
    schemas.move_task_to_project,
    idempotent,
    (input) =>
      tools.move_task_to_project(schemas.move_task_to_project.parse(input)),
    outputSchemas.move_task_to_project
  )
  register(
    "delete_task",
    "Delete Task",
    "Permanently delete a task by id, or by unambiguous project and title. Children require confirmCascade.",
    schemas.delete_task,
    destructive,
    (input) => tools.delete_task(schemas.delete_task.parse(input)),
    outputSchemas.delete_task
  )
  register(
    "create_subtask",
    "Create Subtask",
    "Append a one-level subtask to a task.",
    schemas.create_subtask,
    creates,
    (input) => tools.create_subtask(schemas.create_subtask.parse(input)),
    outputSchemas.create_subtask
  )
  register(
    "rename_subtask",
    "Rename Subtask",
    "Rename a subtask.",
    schemas.rename_subtask,
    idempotent,
    (input) => tools.rename_subtask(schemas.rename_subtask.parse(input)),
    outputSchemas.rename_subtask
  )
  register(
    "set_subtask_completed",
    "Set Subtask Completed",
    "Complete or reopen a subtask.",
    schemas.set_subtask_completed,
    idempotent,
    (input) =>
      tools.set_subtask_completed(schemas.set_subtask_completed.parse(input)),
    outputSchemas.set_subtask_completed
  )
  register(
    "reorder_subtask",
    "Reorder Subtask",
    "Move a subtask immediately before or after another subtask on the same task.",
    schemas.reorder_subtask,
    idempotent,
    (input) => tools.reorder_subtask(schemas.reorder_subtask.parse(input)),
    outputSchemas.reorder_subtask
  )
  register(
    "delete_subtask",
    "Delete Subtask",
    "Permanently delete a subtask.",
    schemas.delete_subtask,
    destructive,
    (input) => tools.delete_subtask(schemas.delete_subtask.parse(input)),
    outputSchemas.delete_subtask
  )
  register(
    "create_comment",
    "Create Comment",
    "Post a root task comment from ordered text and structured mention segments.",
    schemas.create_comment,
    creates,
    (input) => tools.create_comment(schemas.create_comment.parse(input)),
    outputSchemas.create_comment
  )
  register(
    "reply_to_comment",
    "Reply To Comment",
    "Post a direct reply from ordered text and structured mention segments.",
    schemas.reply_to_comment,
    creates,
    (input) => tools.reply_to_comment(schemas.reply_to_comment.parse(input)),
    outputSchemas.reply_to_comment
  )
  register(
    "edit_comment",
    "Edit Comment",
    "Edit the caller's comment using ordered text and structured mention segments.",
    schemas.edit_comment,
    idempotent,
    (input) => tools.edit_comment(schemas.edit_comment.parse(input)),
    outputSchemas.edit_comment
  )
  register(
    "delete_comment",
    "Delete Comment",
    "Tombstone a comment while preserving its descendants.",
    schemas.delete_comment,
    destructive,
    (input) => tools.delete_comment(schemas.delete_comment.parse(input)),
    outputSchemas.delete_comment
  )
  register(
    "create_project",
    "Create Project",
    "Create a new project in the active Organization.",
    schemas.create_project,
    creates,
    (input) => tools.create_project(schemas.create_project.parse(input)),
    outputSchemas.create_project
  )
  register(
    "update_project",
    "Update Project",
    "Update a project's name, icon, or color. Address it by id or unambiguous name.",
    schemas.update_project,
    idempotent,
    (input) => tools.update_project(schemas.update_project.parse(input)),
    outputSchemas.update_project
  )
  register(
    "delete_project",
    "Delete Project",
    "Permanently delete a project and all of its tasks. Requires an explicit projectId.",
    schemas.delete_project,
    destructive,
    (input) => tools.delete_project(schemas.delete_project.parse(input)),
    outputSchemas.delete_project
  )
  register(
    "create_workspace",
    "Create Workspace",
    "Create a Clerk Organization. Reauthorization is required before using the new workspace.",
    schemas.create_workspace,
    creates,
    (input) => tools.create_workspace(schemas.create_workspace.parse(input)),
    outputSchemas.create_workspace
  )
  register(
    "invite_workspace_member",
    "Invite Workspace Member",
    "Invite an email address to the active Organization with an explicit role.",
    schemas.invite_workspace_member,
    creates,
    (input) =>
      tools.invite_workspace_member(
        schemas.invite_workspace_member.parse(input)
      ),
    outputSchemas.invite_workspace_member
  )
  register(
    "update_workspace_member_role",
    "Update Workspace Member Role",
    "Set an Organization member's role.",
    schemas.update_workspace_member_role,
    idempotent,
    (input) =>
      tools.update_workspace_member_role(
        schemas.update_workspace_member_role.parse(input)
      ),
    outputSchemas.update_workspace_member_role
  )
  register(
    "remove_workspace_member",
    "Remove Workspace Member",
    "Remove a member and asynchronously unassign their open tasks. Requires exact Organization confirmation.",
    schemas.remove_workspace_member,
    destructive,
    (input) =>
      tools.remove_workspace_member(
        schemas.remove_workspace_member.parse(input)
      ),
    outputSchemas.remove_workspace_member
  )
  register(
    "delete_workspace",
    "Delete Workspace",
    "Purge Organization-scoped Neram data in resumable batches, then delete Clerk last. Requires exact Organization confirmation.",
    schemas.delete_workspace,
    destructive,
    (input) => tools.delete_workspace(schemas.delete_workspace.parse(input)),
    outputSchemas.delete_workspace
  )
  register(
    "plan_sprint_tasks",
    "Add Sprint Tasks",
    "Add Backlog tasks to the one active Sprint.",
    schemas.plan_sprint_tasks,
    idempotent,
    (input) => tools.plan_sprint_tasks(schemas.plan_sprint_tasks.parse(input)),
    outputSchemas.plan_sprint_tasks
  )
  register(
    "remove_sprint_tasks",
    "Remove Sprint Tasks",
    "Return active Sprint tasks to Backlog; in-progress work also returns to Todo.",
    schemas.remove_sprint_tasks,
    idempotent,
    (input) =>
      tools.remove_sprint_tasks(schemas.remove_sprint_tasks.parse(input)),
    outputSchemas.remove_sprint_tasks
  )
  register(
    "update_sprint_goal",
    "Update Sprint Goal",
    "Set or clear the goal of the active Sprint.",
    schemas.update_sprint_goal,
    idempotent,
    (input) =>
      tools.update_sprint_goal(schemas.update_sprint_goal.parse(input)),
    outputSchemas.update_sprint_goal
  )
  register(
    "update_sprint_duration",
    "Update Sprint Duration",
    "Set the default duration for the next Sprint to 1, 2, or 4 weeks, or open-ended.",
    schemas.update_sprint_duration,
    idempotent,
    (input) =>
      tools.update_sprint_duration(schemas.update_sprint_duration.parse(input)),
    outputSchemas.update_sprint_duration
  )
  register(
    "start_sprint",
    "Start Sprint",
    "Start the one optional Sprint with an empty focus list and an optional goal or duration override.",
    schemas.start_sprint,
    creates,
    (input) => tools.start_sprint(schemas.start_sprint.parse(input)),
    outputSchemas.start_sprint
  )
  register(
    "end_sprint",
    "End Sprint",
    "Close the active Sprint and return unfinished work to Backlog. The next Sprint starts empty.",
    schemas.end_sprint,
    destructive,
    (input) => tools.end_sprint(schemas.end_sprint.parse(input)),
    outputSchemas.end_sprint
  )

  // --- Resources (MCP 2026-07-28 server concepts) ---------------------------
  // Read-only, application-driven context. Same canonical implementation as
  // the tools above so stdio and Streamable HTTP stay in sync.
  const resourceText = (payload: unknown, uri: string) => ({
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  })
  server.registerResource(
    "workspace-status",
    "neram://workspace/status",
    {
      title: "Workspace Status",
      description:
        "Caller identity, active Organization, project count, and open task count.",
      mimeType: "application/json",
    },
    async (uri) => resourceText(await tools.workspace_status({}), uri.href)
  )
  server.registerResource(
    "sprint-current",
    "neram://sprint/current",
    {
      title: "Current Sprint",
      description: "Active Sprint dates, goal, progress counts, and task count.",
      mimeType: "application/json",
    },
    async (uri) => resourceText(await tools.get_sprint({}), uri.href)
  )
  server.registerResource(
    "projects",
    "neram://projects",
    {
      title: "Projects",
      description: "Every visible project with role and task counts.",
      mimeType: "application/json",
    },
    async (uri) => resourceText(await tools.list_projects({}), uri.href)
  )
  server.registerResource(
    "daily-brief",
    "neram://brief/daily",
    {
      title: "Daily Brief",
      description: "Compact daily execution digest with next actions.",
      mimeType: "application/json",
    },
    async (uri) =>
      resourceText(await tools.daily_brief({ projectLimit: 8 }), uri.href)
  )
  server.registerResource(
    "project",
    new ResourceTemplate("neram://project/{id}", { list: undefined }),
    {
      title: "Project",
      description: "Compact project, task, and count context by project id.",
      mimeType: "application/json",
    },
    async (uri, { id }) =>
      resourceText(
        await tools.summarize_project({ projectId: String(id) }),
        uri.href
      )
  )
  server.registerResource(
    "task",
    new ResourceTemplate("neram://task/{id}", { list: undefined }),
    {
      title: "Task",
      description: "One task with subtask progress and comment count.",
      mimeType: "application/json",
    },
    async (uri, { id }) =>
      resourceText(await tools.get_task({ taskId: String(id) }), uri.href)
  )

  // --- Prompts (reusable agent workflows) ------------------------------------
  server.registerPrompt(
    "plan-sprint",
    {
      title: "Plan Sprint",
      description:
        "Triage Backlog into the active Sprint: review backlog, pick focus tasks, set a goal.",
      argsSchema: {},
    },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Plan the active Neram sprint.",
              "1. Call list_sprint_tasks with sprint=current and sprint=backlog.",
              "2. Pick focus tasks from Backlog; call plan_sprint_tasks.",
              "3. Set a concise goal with update_sprint_goal.",
              "Prefer task ids; if a name is ambiguous, retry with the candidate id from details.matches.",
            ].join(" "),
          },
        },
      ],
    })
  )
  server.registerPrompt(
    "daily-standup",
    {
      title: "Daily Standup",
      description: "Summarize assigned work, open tasks, and next actions.",
      argsSchema: {},
    },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "Call daily_brief, then summarize assignedOpenTasks, openTasks due soon, and suggestedNextActions in 5 bullets.",
          },
        },
      ],
    })
  )
  server.registerPrompt(
    "project-retro",
    {
      title: "Project Retro",
      description:
        "Review a project by id or unambiguous name: counts, done vs open, stale work.",
      argsSchema: {
        projectId: z.string().optional().describe("Exact project id (preferred)."),
        project: z
          .string()
          .optional()
          .describe("Unambiguous project name when the id is unknown."),
      },
    },
    async ({ projectId, project }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Call summarize_project for the target project,",
              projectId
                ? `using projectId "${projectId}"`
                : project
                  ? `using project "${project}"`
                  : "using its id (preferred) or unambiguous name",
              "then report counts, completed vs open, and the 3 stalest open tasks.",
            ].join(" "),
          },
        },
      ],
    })
  )
  server.registerPrompt(
    "triage-capture",
    {
      title: "Triage Capture",
      description: "Capture a task into the right project with title and due date.",
      argsSchema: {},
    },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "Call list_projects, pick the unambiguous target project, then capture_task with a verb-led title under 120 chars.",
          },
        },
      ],
    })
  )

  server.server.onerror = (error) => {
    console.error(toAgentError(error).message)
  }
  return server
}

/**
 * Start the stdio MCP server.
 *
 * Auth is deliberately deferred: the server starts and completes the MCP
 * `initialize` handshake even when no session exists, because the token
 * provider is only resolved at tool-call time (see `createConvexApi`). A
 * missing or expired session therefore surfaces as an `isError` tool result on
 * the first real call — never as a process exit that makes the client see a
 * closed connection and park the server.
 */
export async function runStdioMcp(
  convexUrl: string,
  getToken: TokenProvider
): Promise<void> {
  const server = createNeramMcpServer(createConvexApi(convexUrl, getToken))
  await server.connect(new StdioServerTransport())
}

/**
 * Validate 2026-07-28 Streamable HTTP routing headers when present.
 * Gateways route on Mcp-Method/Mcp-Name without body inspection; a mismatch
 * between headers and the JSON-RPC body must be rejected so a `tools/call`
 * for project A can never execute as project B.
 */
function mcpHeaderMismatch(
  headers: { get(name: string): string | null } | Record<string, unknown>,
  body: unknown
): string | null {
  const get =
    typeof (headers as { get?: unknown }).get === "function"
      ? (name: string) =>
          (headers as { get(n: string): string | null }).get(name)
      : (name: string) => {
          const v = (headers as Record<string, unknown>)[
            name.toLowerCase()
          ] as unknown
          return typeof v === "string" ? v : null
        }
  const headerMethod = get("mcp-method")
  const headerName = get("mcp-name")
  if (!headerMethod && !headerName) return null
  const payload = (body ?? {}) as {
    method?: unknown
    params?: { name?: unknown }
  }
  if (
    headerMethod &&
    typeof payload.method === "string" &&
    headerMethod !== payload.method
  ) {
    return `Mcp-Method "${headerMethod}" does not match body method "${payload.method}".`
  }
  const bodyName =
    typeof payload.params?.name === "string" ? payload.params.name : null
  if (headerName && bodyName && headerName !== bodyName) {
    return `Mcp-Name "${headerName}" does not match body tool "${bodyName}".`
  }
  return null
}

export async function handleHttpMcp(
  req: IncomingMessage & { body?: unknown; headers: Record<string, unknown> },
  res: ServerResponse,
  client: NeramApi
) {
  if (req.method !== "POST") {
    res.writeHead(405, {
      allow: "POST",
      "content-type": "application/json",
    })
    res.end(
      JSON.stringify({
        error: {
          code: "METHOD_NOT_ALLOWED",
          message:
            "Use POST for MCP Streamable HTTP (2026-07-28, stateless; no session).",
        },
      })
    )
    return
  }
  const mismatch = mcpHeaderMismatch(
    req.headers as Record<string, unknown>,
    req.body
  )
  if (mismatch) {
    res.writeHead(400, { "content-type": "application/json" })
    res.end(
      JSON.stringify({ error: { code: "HEADER_MISMATCH", message: mismatch } })
    )
    return
  }
  const server = createNeramMcpServer(client)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (error) {
    if (!res.headersSent) {
      const err = toAgentError(error)
      res.writeHead(500, { "content-type": "application/json" })
      res.end(
        JSON.stringify({ error: { code: err.code, message: err.message } })
      )
    }
  } finally {
    await transport.close()
    await server.close()
  }
}

export async function handleFetchMcp(
  request: Request,
  client: NeramApi
): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message:
            "Use POST for MCP Streamable HTTP (2026-07-28, stateless; no session).",
        },
      },
      { headers: { allow: "POST" }, status: 405 }
    )
  }
  let body: unknown
  try {
    body = await request.clone().json()
  } catch {
    body = undefined
  }
  const mismatch = mcpHeaderMismatch(
    { get: (name: string) => request.headers.get(name) },
    body
  )
  if (mismatch) {
    return Response.json(
      { error: { code: "HEADER_MISMATCH", message: mismatch } },
      { status: 400 }
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
