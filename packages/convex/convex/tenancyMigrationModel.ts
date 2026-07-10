import type { Doc } from "./_generated/dataModel"

export function legacyActivityRecipient(activity: Doc<"activity">) {
  if (
    activity.type !== "comment.mentioned" &&
    activity.type !== "comment.replied"
  ) {
    return undefined
  }
  return activity.subject.split("|").at(-1) ?? activity.subject
}

export function legacyActivityKey(activity: Doc<"activity">) {
  return [
    activity.projectId,
    activity.actorSubject,
    activity.type,
    activity.taskTitle ?? "",
    activity.toStatus ?? "",
    activity.assigneeSubject ?? "",
    activity.createdAt,
    legacyActivityRecipient(activity) ?? "",
  ].join("|")
}
