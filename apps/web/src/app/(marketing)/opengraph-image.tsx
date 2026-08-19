import { ImageResponse } from "next/og"

export const alt = "Neram — Give your agent a workspace"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 48,
        background: "#0a0a0a",
        color: "white",
      }}
    >
      <div style={{ display: "flex", fontSize: 20, opacity: 0.7 }}>
        neram.praveenjuge.com
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            letterSpacing: -2,
            lineHeight: 1,
          }}
        >
          Give your coding
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            letterSpacing: -2,
            lineHeight: 1,
            color: "#8ff044",
          }}
        >
          agent a workspace.
        </div>
        <div style={{ fontSize: 20, opacity: 0.7, maxWidth: 700 }}>
          Quiet, organization-wide Sprints for teams and coding agents. CLI +
          MCP.
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 16, opacity: 0.6 }}>
        <span
          style={{
            border: "1px solid #333",
            padding: "6px 12px",
            borderRadius: 999,
          }}
        >
          MIT · Free hosted
        </span>
        <span
          style={{
            border: "1px solid #333",
            padding: "6px 12px",
            borderRadius: 999,
          }}
        >
          npx neram mcp
        </span>
      </div>
    </div>,
    size
  )
}
