import type { Command } from "commander"

import { AgentError, createTools } from "./agent.js"
import { login } from "./auth.js"

type OutputOptions = { json?: boolean }
type Tools = ReturnType<typeof createTools>

type Runtime = {
  tools: () => Promise<Tools>
  emit: (opts: OutputOptions, human: string, json: unknown) => void
  wrap: (opts: OutputOptions, fn: () => Promise<void>) => void
}

const toInt = (value: string) => Number.parseInt(value, 10)

function workspaceLine(context: Awaited<ReturnType<Tools["get_workspace"]>>) {
  return `${context.organization.name} (${context.organization.slug}) · ${context.membership.role}`
}

function memberLines(
  result: Awaited<ReturnType<Tools["list_workspace_members"]>>
) {
  return result.members.length
    ? result.members
        .map(
          (member) =>
            `${member.displayName} · ${member.role} · ${member.email ?? member.userId}`
        )
        .join("\n")
    : "No members."
}

function sprintLines(result: Awaited<ReturnType<Tools["list_sprint_tasks"]>>) {
  const heading = result.details
    ? `Current Sprint · ${result.tasks.length} tasks`
    : `${result.sprint} · ${result.tasks.length} tasks`
  const tasks = result.tasks.map(
    (task) =>
      `  ${task.taskId}  ${task.title} · ${task.projectName} · ${task.status}`
  )
  return [heading, ...tasks].join("\n")
}

function sprintDuration(value: string) {
  if (value === "open") return value
  const weeks = toInt(value)
  if (weeks === 1 || weeks === 2 || weeks === 4) return weeks
  throw new AgentError("VALIDATION", "Use duration 1, 2, 4, or open.")
}

export function registerPlanningCommands(program: Command, runtime: Runtime) {
  const { emit, tools, wrap } = runtime
  const workspace = program
    .command("workspace")
    .description("Manage the active Clerk Organization workspace")

  workspace
    .command("current")
    .description("Show the Organization bound to the current OAuth token")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (await tools()).get_workspace({})
        emit(opts, workspaceLine(result), result)
      })
    )

  workspace
    .command("create")
    .description("Create a Clerk Organization workspace")
    .requiredOption("--name <name>")
    .option("--slug <slug>")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (await tools()).create_workspace(opts)
        emit(
          opts,
          `Created ${result.name} (${result.slug}). Run \`neram workspace switch\` to authorize it.`,
          result
        )
      })
    )

  workspace
    .command("switch")
    .description("Rerun Clerk OAuth and choose a different Organization")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        await login({}, { forceOrganizationSelection: true })
        const context = await (await tools()).get_workspace({})
        const organization = {
          organizationId: context.organization.organizationId,
          slug: context.organization.slug,
          role: context.membership.role,
        }
        emit(
          opts,
          `Switched to ${organization.slug} (${organization.role}). Reconnect running MCP clients.`,
          { switched: true, organization, reconnectMcp: true }
        )
      })
    )

  workspace
    .command("members")
    .description("List members of the active Organization")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (await tools()).list_workspace_members({})
        emit(opts, memberLines(result), result)
      })
    )

  workspace
    .command("invite")
    .description("Invite a member by email")
    .requiredOption("--email <email>")
    .option("--role <org:admin|org:member>", "Organization role", "org:member")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (await tools()).invite_workspace_member(opts)
        emit(
          opts,
          `Invitation ${result.status}: ${result.invitationId}`,
          result
        )
      })
    )

  workspace
    .command("role")
    .description("Update an Organization member role")
    .requiredOption("--user-id <id>")
    .requiredOption("--role <org:admin|org:member>")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (await tools()).update_workspace_member_role(opts)
        emit(opts, `Updated ${result.userId} to ${result.role}.`, result)
      })
    )

  workspace
    .command("remove-member")
    .description("Remove a member and unassign their open tasks")
    .requiredOption("--user-id <id>")
    .requiredOption("--organization-id <id>")
    .requiredOption("--organization-slug <slug>")
    .option("--confirm", "Confirm the destructive operation")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (await tools()).remove_workspace_member(opts)
        emit(opts, `Removed ${result.userId}.`, result)
      })
    )

  workspace
    .command("delete")
    .description("Purge the workspace, then delete its Clerk Organization")
    .requiredOption("--organization-id <id>")
    .requiredOption("--organization-slug <slug>")
    .option("--confirm", "Confirm the destructive operation")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (await tools()).delete_workspace(opts)
        emit(opts, `Workspace deletion started (${result.jobId}).`, result)
      })
    )

  const sprint = program
    .command("sprint")
    .description("Plan and manage Sprints")

  for (const placement of ["current", "backlog"] as const) {
    sprint
      .command(placement)
      .description(`Show ${placement} Sprint work`)
      .option("--json")
      .action((opts) =>
        wrap(opts, async () => {
          const result = await (
            await tools()
          ).list_sprint_tasks({
            sprint: placement,
          })
          emit(opts, sprintLines(result), result)
        })
      )
  }

  sprint
    .command("history")
    .description("List closed Sprints with committed and completed counts")
    .option("--cursor <cursor>")
    .option("--limit <n>", "Page size (1-50)", toInt)
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (
          await tools()
        ).sprint_history({
          cursor: opts.cursor,
          pageSize: opts.limit,
        })
        emit(opts, JSON.stringify(result, null, 2), result)
      })
    )

  sprint
    .command("start")
    .description("Start one optional Sprint with an empty focus list")
    .option("--goal <goal>")
    .option("--duration <1|2|4|open>")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (
          await tools()
        ).start_sprint({
          goal: opts.goal,
          duration: opts.duration ? sprintDuration(opts.duration) : undefined,
        })
        emit(opts, `Started Sprint ${result.sprintId}.`, result)
      })
    )

  sprint
    .command("plan")
    .description("Add Backlog tasks to the active Sprint")
    .requiredOption("--task-id <ids...>")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (
          await tools()
        ).plan_sprint_tasks({
          taskIds: opts.taskId,
        })
        emit(opts, `Added ${result.taskIds.length} task(s) to Current.`, result)
      })
    )

  sprint
    .command("remove")
    .description("Return active Sprint tasks to Backlog")
    .requiredOption("--task-id <ids...>")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (
          await tools()
        ).remove_sprint_tasks({
          taskIds: opts.taskId,
        })
        emit(
          opts,
          `Returned ${result.taskIds.length} task(s) to Backlog.`,
          result
        )
      })
    )

  sprint
    .command("goal")
    .description("Set or clear the active Sprint goal")
    .option("--goal <goal>")
    .option("--clear", "Clear the goal")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        if (opts.goal === undefined && !opts.clear) {
          throw new AgentError("VALIDATION", "Provide --goal or --clear.")
        }
        const result = await (
          await tools()
        ).update_sprint_goal({
          goal: opts.clear ? undefined : opts.goal,
        })
        emit(opts, "Updated the Sprint goal.", result)
      })
    )

  sprint
    .command("duration")
    .description("Set the default duration for the next Sprint")
    .requiredOption("--value <1|2|4|open>")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (
          await tools()
        ).update_sprint_duration({
          duration: sprintDuration(opts.value),
        })
        emit(opts, `Default duration updated to ${result.duration}.`, result)
      })
    )

  sprint
    .command("end")
    .description("End Current and return unfinished work to Backlog")
    .option("--confirm", "Confirm the Sprint close")
    .option("--json")
    .action((opts) =>
      wrap(opts, async () => {
        const result = await (
          await tools()
        ).end_sprint({ confirm: opts.confirm })
        emit(opts, `Sprint close started (${result.jobId}).`, result)
      })
    )
}
