import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import type { ReactNode } from "react"

import { Providers } from "@/app/providers"
import { SwRegistration } from "@/components/sw-registration"

import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Neram",
    template: "%s — Neram",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/pwa-icon.svg", type: "image/svg+xml" },
      { url: "/pwa-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/pwa-192.png", sizes: "192x192", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  themeColor: "#8ff044",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={GeistSans.variable} lang="en" suppressHydrationWarning>
      <body className="antialiased text-sm">
        <Providers>
          <SwRegistration />
          {children}
        </Providers>
      </body>
    </html>
  )
}
