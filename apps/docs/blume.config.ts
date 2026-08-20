import { defineConfig } from "blume"

export default defineConfig({
  title: "Neram",
  description:
    "Projects hold all work. One optional Sprint keeps humans and agents focused on what matters now.",
  github: {
    owner: "praveenjuge",
    repo: "neram",
    dir: "apps/docs",
  },
  theme: {
    accent: "green",
    radius: "md",
    fonts: {
      display: "geist",
      body: "geist",
      mono: "geist-mono",
    },
  },
  content: {
    root: "content",
  },
  deployment: {
    output: "static",
    site: "https://neram.praveenjuge.com",
  },
  navigation: {
    tabs: [
      { label: "Docs", path: "/docs" },
      {
        label: "Sign in",
        path: "https://accounts.neram.praveenjuge.com/sign-in?redirect_url=https%3A%2F%2Fneram.praveenjuge.com%2Fw",
      },
    ],
  },
  seo: {
    og: { enabled: true },
    rss: { enabled: false },
    sitemap: true,
    robots: true,
    structuredData: true,
  },
})
