import { OrganizationList } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { AppProviders } from "@/components/app-providers"
import { workspaceHref } from "@/lib/workspace"

const hostedSignInUrl =
  "https://accounts.neram.praveenjuge.com/sign-in?redirect_url=https%3A%2F%2Fneram.praveenjuge.com%2Fw"

export const instant = false

export default async function WorkspacePage() {
  const { orgSlug, userId } = await auth()

  if (!userId) redirect(hostedSignInUrl)
  if (orgSlug) redirect(workspaceHref(orgSlug))

  return (
    <AppProviders>
      <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
        <OrganizationList
          afterCreateOrganizationUrl="/w/:slug/dashboard"
          afterSelectOrganizationUrl="/w/:slug/dashboard"
          hidePersonal
        />
      </main>
    </AppProviders>
  )
}
