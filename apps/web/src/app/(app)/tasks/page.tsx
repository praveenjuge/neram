import { TasksClient } from "@/app/(app)/tasks/tasks-client"

export const metadata = {
  title: "Tasks",
}

export const instant = false

export default function TasksPage() {
  return (
    <main className="contents">
      <TasksClient />
    </main>
  )
}
