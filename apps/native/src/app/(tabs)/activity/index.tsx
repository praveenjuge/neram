import { useAuth } from "@clerk/expo"
import { api } from "@neram/convex/api"
import { usePaginatedQuery } from "convex/react"
import { router } from "expo-router"

import { Empty, Row, Screen, Section, Text, VStack } from "@/lib/ui"

export default function ActivityScreen() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false })
  const feed = usePaginatedQuery(api.activity.list, isSignedIn ? {} : "skip", {
    initialNumItems: 10,
  })

  return (
    <Screen>
      <Section title="Activity">
        {feed.status === "LoadingFirstPage" ? (
          <Text>Loading activity...</Text>
        ) : feed.results.length === 0 ? (
          <Empty
            title="No activity yet"
            detail="Task changes will appear here as Convex updates."
          />
        ) : (
          feed.results.map((item) => {
            const taskId = "taskId" in item ? item.taskId : undefined
            const commentId = "commentId" in item ? item.commentId : undefined
            return taskId ? (
              <Row
                key={item._id}
                label={`${activityLine(item)} · ${item.projectName ?? "Workspace"}`}
                systemImage={commentId ? "text.bubble" : "checklist"}
                onPress={() =>
                  router.push(
                    `/task/${taskId}${commentId ? `?commentId=${commentId}` : ""}`
                  )
                }
              />
            ) : (
              <VStack key={item._id} alignment="leading" spacing={2}>
                <Text>{item.projectName ?? "Workspace"}</Text>
                <Text>{activityLine(item)}</Text>
              </VStack>
            )
          })
        )}
      </Section>
    </Screen>
  )
}

function activityLine(item: {
  actorName: string
  type: string
  taskTitle?: string
  toStatus?: string
  commentExcerpt?: string
}) {
  if (item.type === "task.created")
    return `${item.actorName} created ${item.taskTitle}`
  if (item.type === "task.moved")
    return `${item.actorName} moved ${item.taskTitle} to ${item.toStatus}`
  if (item.type === "task.assigned")
    return `${item.actorName} assigned ${item.taskTitle}`
  if (item.type === "project.updated")
    return `${item.actorName} updated the project`
  if (item.type === "member.joined") return `${item.actorName} joined`
  if (item.type === "member.left") return `${item.actorName} left`
  if (item.type === "member.removed") return `${item.actorName} was removed`
  if (item.type === "comment.mentioned")
    return `${item.actorName} mentioned you on ${item.taskTitle}${item.commentExcerpt ? `: ${item.commentExcerpt}` : ""}`
  if (item.type === "comment.replied")
    return `${item.actorName} replied to you on ${item.taskTitle}${item.commentExcerpt ? `: ${item.commentExcerpt}` : ""}`
  if (item.type === "sprint.started") return `${item.actorName} started a Sprint`
  if (item.type === "sprint.rolled_over")
    return `${item.actorName} rolled over a Sprint`
  if (item.type === "sprint.early_closed")
    return `${item.actorName} closed a Sprint early`
  if (item.type === "sprint.cadence_changed")
    return `${item.actorName} updated the Sprint cadence`
  return `${item.actorName} updated ${item.taskTitle ?? "the project"}`
}
