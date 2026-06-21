import { Outlet, createRootRoute } from "@tanstack/react-router"

export const Route = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <main className="flex min-h-svh items-center justify-center p-6 text-sm">
      <p>That page is not available.</p>
    </main>
  ),
})
