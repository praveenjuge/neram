import { defineConfig } from "blume";

export default defineConfig({
  title: "Neram",
  description:
    "A quiet cadence for shared work — org-wide projects, a recurring Sprint with memory, and the same commitments for humans and agents.",
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
      { label: "Sign in", path: "/sign-in", href: "/sign-in" },
    ],
  },
  seo: {
    og: { enabled: true },
    rss: { enabled: false },
    sitemap: true,
    robots: true,
    structuredData: true,
  },
});
