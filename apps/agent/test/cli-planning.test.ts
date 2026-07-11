import { Command } from "commander"
import { expect, test, vi } from "vitest"

const login = vi.hoisted(() => vi.fn())

vi.mock("../src/auth.js", () => ({ login }))

import { registerPlanningCommands } from "../src/cli-planning.js"

test("workspace switch forces Organization selection and reports reconnection", async () => {
  login.mockResolvedValue({
    user: {
      org_id: "org_2",
    },
  })
  const program = new Command()
  program.exitOverride()
  const emit = vi.fn()
  const getWorkspace = vi.fn().mockResolvedValue({
    organization: {
      organizationId: "org_2",
      slug: "beta",
      name: "Beta",
      state: "active",
    },
    membership: {
      role: "org:admin",
    },
    settings: null,
  })
  registerPlanningCommands(program, {
    tools: vi.fn().mockResolvedValue({ get_workspace: getWorkspace }),
    emit,
    wrap: (_opts, fn) => void fn(),
  })

  await program.parseAsync(["node", "neram", "workspace", "switch", "--json"], {
    from: "node",
  })
  await vi.waitFor(() => expect(login).toHaveBeenCalledOnce())
  await vi.waitFor(() => expect(getWorkspace).toHaveBeenCalledOnce())
  expect(login).toHaveBeenCalledWith({}, { forceOrganizationSelection: true })
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ json: true }),
    expect.stringContaining("Reconnect running MCP clients"),
    expect.objectContaining({
      switched: true,
      reconnectMcp: true,
      organization: expect.objectContaining({ organizationId: "org_2" }),
    })
  )
})
