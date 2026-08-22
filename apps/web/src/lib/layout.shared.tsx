import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

export const SITE_URL = "https://neram.praveenjuge.com"

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Neram",
      url: "/",
    },
    links: [
      {
        text: "GitHub",
        url: "https://github.com/praveenjuge/neram",
        external: true,
      },
      {
        text: "Sign in",
        url: "https://accounts.neram.praveenjuge.com/sign-in?redirect_url=https%3A%2F%2Fneram.praveenjuge.com%2Fw",
      },
    ],
  }
}
