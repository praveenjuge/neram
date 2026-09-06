import { expect, test } from "@playwright/test"
import { instant } from "@next/playwright"

// Docs are fully static (generateStaticParams), so they exercise the instant
// shell without Clerk/Convex auth. Workspace routes stay client-driven and
// are covered by skeleton fallbacks instead.
test.describe("docs instant navigation", () => {
  test("docs index title is instant on initial load", async ({
    page,
    baseURL,
  }) => {
    await instant(
      page,
      async () => {
        await page.goto("/docs")
        await expect(
          page.getByRole("heading", { level: 1 }).first()
        ).toBeVisible()
      },
      { baseURL }
    )
  })

  // Client navigations use the default shell-only prefetch (fumadocs sidebar
  // links don't opt into prefetch={true} runtime prefetching), so page
  // content streams after click by design. This guards the route without
  // the instant lock; the instant assertion above covers the static shell.
  test("docs cli page loads on client navigation", async ({ page }) => {
    await page.goto("/docs")
    await page.getByRole("link", { name: "CLI" }).first().click()
    await page.waitForURL((url) => url.pathname === "/docs/cli")
    await expect(
      page.getByRole("heading", { name: "CLI" }).first()
    ).toBeVisible()
  })
})
