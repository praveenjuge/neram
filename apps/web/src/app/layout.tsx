import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { RootProvider } from "fumadocs-ui/provider/next"

import { ThemeProvider } from "@/components/theme-provider"
import { LazyToaster } from "@/components/lazy-toaster"
import { OfflineBanner } from "@/components/offline-banner"
import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL("https://neram.praveenjuge.com"),
  title: {
    default: "Neram — Quiet commitments for teams and agents",
    template: "%s — Neram",
  },
  description:
    "Organization-wide projects and Sprints. Give your coding agent a workspace with CLI and MCP.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/pwa-icon.svg", type: "image/svg+xml" },
      { url: "/pwa-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/pwa-192.png", sizes: "192x192", type: "image/png" }],
  },
  alternates: {
    canonical: "https://neram.praveenjuge.com",
  },
}

export const viewport: Viewport = {
  themeColor: "#8ff044",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col text-sm antialiased">
        <OfflineBanner />
        <ThemeProvider>
          <TooltipProvider>
            <RootProvider theme={{ enabled: false }}>{children}</RootProvider>
            <LazyToaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
