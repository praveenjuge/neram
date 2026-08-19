import type { Metadata } from "next"

import { SignInClient } from "./sign-in-client"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Neram with Clerk.",
}

export default function SignInPage() {
  return (
    <main className="mx-auto grid max-w-6xl place-items-center px-5 py-12">
      <SignInClient />
    </main>
  )
}
