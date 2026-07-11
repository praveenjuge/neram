import { Command } from "commander"
import { expect, test, vi } from "vitest"

const login = vi.hoisted(() => vi.fn())

vi.mock("../src/auth.js", () => ({ login }))

import { registerPlanningCommands } from "../src/cli-planning.js"

test("workspace switch forces Organization selection and reports reconnection", async () => {
  login.mockResolvedValue({
    user: {
      org_id: "org_2",
      org_slug: "beta",
      org_role: "org:admin",
    },
  })
  const program = new Command()
  program.exitOverride()
  const emit = vi.fn()
  registerPlanningCommands(program, {
    tools: vi.fn(),
    emit,
    wrap: (_opts, fn) => void fn(),
  })

  await program.parseAsync(["node", "neram", "workspace", "switch", "--json"], {
    from: "node",
  })
  await vi.waitFor(() => expect(login).toHaveBeenCalledOnce())
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
