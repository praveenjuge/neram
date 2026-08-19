import type { Metadata } from "next"

import { CodeBlock, H1, H2, Lead, Prose } from "../components"

export const metadata: Metadata = {
  title: "Reference — Error Codes",
  description: "Stable, machine-readable error codes for CLI and MCP.",
}

const codes = `UNAUTHENTICATED       # run neram login
MISSING_CONFIG        # config fetch failed; check network or env overrides
AMBIGUOUS             # name matched multiple records; retry with an id from details.matches
NOT_FOUND             # project or task does not exist
FORBIDDEN             # caller lacks access
ORGANIZATION_REQUIRED # choose a workspace and sign in again
CONFIRMATION_REQUIRED # exact Organization id/slug or confirmation is missing
VALIDATION            # bad input shape or value`

const payload = `{
  "error": {
    "code": "AMBIGUOUS",
    "message": "Multiple projects matched \\"Website\\".",
    "details": {
      "matches": [
        { "id": "j57abc...", "name": "Website" },
        { "id": "j57def...", "name": "Website" }
      ]
    }
  }
}`

export default function ReferencePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <H1>Reference</H1>
      <Lead>
        CLI and MCP failures use stable, machine-readable codes. An{" "}
        <code>AMBIGUOUS</code> response includes candidate ids in{" "}
        <code>details.matches</code> so agents can retry with an exact id.
      </Lead>

      <H2>Error codes</H2>
      <div className="mt-3 grid gap-3">
        <CodeBlock lang="bash">{codes}</CodeBlock>
        <CodeBlock
          label="AMBIGUOUS payload (CLI --json and MCP isError)"
          lang="json"
        >
          {payload}
        </CodeBlock>
      </div>

      <H2>Tool failure shape</H2>
      <Prose>
        MCP tool failures return <code>isError: true</code> with{" "}
        <code>
          content: [{`{`} type: &quot;text&quot;, text: JSON.stringify({`{`}{" "}
          error {`}`} ) {`}`}]
        </code>
        . They are not protocol exceptions. The same shape is returned by{" "}
        <code>neram --json</code> commands on failure.
      </Prose>

      <H2>Config</H2>
      <Prose>
        Public CLI config is at <code>/.well-known/neram-agent.json</code>. It
        exposes <code>convexUrl</code>, <code>clerkFrontendApiUrl</code>, and{" "}
        <code>oauthClientId</code>. Override only for local dev with{" "}
        <code>NERAM_CONVEX_URL</code>, <code>NERAM_CLERK_FRONTEND_API_URL</code>
        , <code>NERAM_CLERK_OAUTH_CLIENT_ID</code>.
      </Prose>

      <H2>Skills</H2>
      <Prose>
        The <code>neram</code> skill (<code>skills/neram/SKILL.md</code>,
        grouped as &quot;Neram&quot; in <code>skills.sh.json</code>) teaches an
        agent to use the CLI and MCP surfaces above instead of browser
        automation.
      </Prose>
    </div>
  )
}
