import { ImageResponse } from "next/og"

export const contentType = "image/png"

const SIZE = { width: 1200, height: 630 }

function clamp(value: string | null, fallback: string, max = 200) {
  if (!value) return fallback
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = clamp(searchParams.get("title"), "Docs", 80)
  const description = clamp(
    searchParams.get("description"),
    "Neram docs — projects with an optional shared focus Sprint."
  )

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          backgroundColor: "#ffffff",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.06) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#525252" }}>
          Neram Docs
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 600,
              letterSpacing: -2,
              color: "#0a0a0a",
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#555555" }}>
            {description}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#888888" }}>
          neram.praveenjuge.com/docs
        </div>
      </div>
    ),
    SIZE
  )
}
