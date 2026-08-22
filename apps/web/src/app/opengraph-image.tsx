import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Neram — A quieter way to focus"

export default function opengraphImage() {
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 30,
            color: "#525252",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: "#8ff044",
              display: "flex",
            }}
          />
          Neram
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 600,
              letterSpacing: -2,
              color: "#0a0a0a",
            }}
          >
            Work that stays where agents can find it.
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "#555555" }}>
            Projects hold all work. One optional Sprint keeps humans and agents
            focused on what matters now.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#888888" }}>
          neram.praveenjuge.com
        </div>
      </div>
    ),
    size
  )
}
