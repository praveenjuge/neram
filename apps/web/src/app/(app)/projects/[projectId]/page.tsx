import { ProjectBoardClient } from "@/app/(app)/projects/[projectId]/project-board-client"

export const metadata = {
  title: "Project",
}

export const instant = false

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  return (
    <main className="contents">
      <ProjectBoardClient projectId={projectId} />
    </main>
  )
}
