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

/** Home page header: Docs link on the left, primary Sign-in button on the
 * right, no search or theme toggle. */
export function homeOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Neram",
      url: "/",
    },
    links: [
      {
        text: "Docs",
        url: "/docs",
      },
      {
        type: "custom",
        secondary: true,
        children: (
          <a
            className="inline-flex h-8 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90"
            href="https://accounts.neram.praveenjuge.com/sign-in?redirect_url=https%3A%2F%2Fneram.praveenjuge.com%2Fw"
          >
            Sign in
          </a>
        ),
      },
    ],
    searchToggle: { enabled: false },
    themeSwitch: { enabled: false },
  }
}
