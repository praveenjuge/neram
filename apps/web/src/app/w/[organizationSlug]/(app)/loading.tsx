import { Spinner } from "@/components/ui/spinner"

export default function AppLoading() {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <Spinner className="size-6 text-muted-foreground" />
    </main>
  )
}
