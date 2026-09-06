import { Spinner } from "@/components/ui/spinner"

export default function AppLoading() {
  return (
    <div className="grid flex-1 place-items-center p-6">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  )
}
