export function MissingEnv() {
  return (
    <div className="flex min-h-svh items-center p-6">
      <div className="max-w-lg text-sm leading-6">
        <h1 className="text-base font-medium">Neram is missing runtime configuration.</h1>
        <p className="mt-2 text-muted-foreground">
          Set VITE_CLERK_PUBLISHABLE_KEY and VITE_CONVEX_URL, then restart the app.
        </p>
      </div>
    </div>
  )
}
