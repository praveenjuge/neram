export type Status = "todo" | "inProgress" | "done"

export type Project = {
  _id: string
  name: string
  role: "org:admin" | "org:member"
  taskCount: number
  todoCount: number
  inProgressCount: number
  doneCount: number
  updatedAt: number
}

export type Task = {
  _id: string
  projectId: string
  title: string
  description?: string
  dueDate?: string
  status: Status
  assigneeSubject?: string
  assigneeName?: string
  totalSubtasks: number
  completedSubtasks: number
  activeCommentCount: number
  updatedAt: number
}

export type Subtask = {
  _id: string
  taskId: string
  title: string
  completed: boolean
  position: number
  createdAt: number
  updatedAt: number
}

export type Mention = {
  start: number
  length: number
  subject: string
  label: string
}

export type TaskComment = {
  _id: string
  taskId: string
  parentCommentId?: string
  rootCommentId?: string
  authorSubject: string
  authorName: string
  body: string
  mentions: Mention[]
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export type CommentPage = {
  page: TaskComment[]
  isDone: boolean
  continueCursor: string
}

export type Activity = {
  actorName: string
  projectName: string
  type: string
  taskTitle?: string
  taskId?: string
  commentId?: string
  commentExcerpt?: string
  toStatus?: Status
  createdAt: number
}

export type WorkspaceStatus = {
  identity: { name?: string; email?: string }
  organization: {
    organizationId: string
    slug: string
    name: string
    role: "org:admin" | "org:member"
  }
  workspace: {
    projects: number
    openTasks: number
  }
}
