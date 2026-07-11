import * as z from "zod/v3"

export const statusSchema = z.enum(["todo", "inProgress", "done"])
export const sprintPlacementSchema = z.enum(["backlog", "current", "upcoming"])
export const sprintRefSchema = z.enum(["current", "upcoming"])
export const organizationRoleSchema = z.enum(["org:admin", "org:member"])

export const projectRefSchema = z.object({
  projectId: z.string().optional(),
  project: z.string().min(1).optional(),
})

export const taskRefSchema = projectRefSchema.extend({
  taskId: z.string().optional(),
  taskTitle: z.string().optional(),
})

const titleSchema = z.string().min(1).max(120)
const descriptionSchema = z.string().max(2000)
const dueDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const projectNameSchema = z.string().min(1).max(80)
export const commentBodySchema = z.string().min(1).max(5000)
export const commentSegmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({
    type: z.literal("mention"),
    subject: z.string().min(1),
    label: z.string().min(1).max(100),
  }),
])

const organizationConfirmation = z.object({
  organizationId: z.string().min(1),
  organizationSlug: z.string().min(1).max(64),
  confirm: z.literal(true),
})

export const schemas = {
  daily_brief: z.object({
    projectLimit: z.number().int().min(1).max(20).default(8),
  }),
  capture_task: projectRefSchema.extend({
    title: titleSchema,
    description: descriptionSchema.optional(),
    dueDate: dueDateSchema.optional(),
    assigneeSubject: z.string().optional(),
    sprint: sprintPlacementSchema.default("backlog"),
  }),
  move_task: taskRefSchema.extend({
    status: statusSchema,
    position: z.number().optional(),
    confirmIncompleteSubtasks: z.boolean().optional(),
  }),
  complete_task: taskRefSchema.extend({
    confirmIncompleteSubtasks: z.boolean().optional(),
  }),
  summarize_project: projectRefSchema,
  workspace_status: z.object({}),
  list_projects: z.object({}),
  list_tasks: projectRefSchema.extend({ status: statusSchema.optional() }),
  update_task: taskRefSchema.extend({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    dueDate: dueDateSchema.optional(),
    clearAssignee: z.boolean().optional(),
  }),
  delete_task: taskRefSchema.extend({ confirmCascade: z.boolean().optional() }),
  move_task_to_project: taskRefSchema.extend({
    toProjectId: z.string().optional(),
    toProject: z.string().min(1).optional(),
  }),
  create_project: z.object({
    name: projectNameSchema,
    icon: z.string().optional(),
    color: z.string().optional(),
  }),
  update_project: projectRefSchema.extend({
    name: projectNameSchema.optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
  }),
  delete_project: z.object({ projectId: z.string().min(1) }),
  recent_activity: z.object({
    limit: z.number().int().min(1).max(50).default(12),
  }),
  get_task: z.object({ taskId: z.string().min(1) }),
  list_subtasks: z.object({
    taskId: z.string().min(1),
    hideCompleted: z.boolean().optional(),
  }),
  create_subtask: z.object({
    taskId: z.string().min(1),
    title: z.string().min(1).max(200),
  }),
  rename_subtask: z.object({
    subtaskId: z.string().min(1),
    title: z.string().min(1).max(200),
  }),
  set_subtask_completed: z.object({
    subtaskId: z.string().min(1),
    completed: z.boolean(),
  }),
  reorder_subtask: z.object({
    subtaskId: z.string().min(1),
    beforeSubtaskId: z.string().min(1).optional(),
    afterSubtaskId: z.string().min(1).optional(),
  }),
  delete_subtask: z.object({ subtaskId: z.string().min(1) }),
  list_task_comments: z.object({
    taskId: z.string().min(1),
    parentCommentId: z.string().min(1).optional(),
    cursor: z.string().nullable().optional(),
    pageSize: z.number().int().min(1).max(20).default(20),
  }),
  create_comment: z.object({
    taskId: z.string().min(1),
    segments: z.array(commentSegmentSchema).min(1),
  }),
  reply_to_comment: z.object({
    commentId: z.string().min(1),
    segments: z.array(commentSegmentSchema).min(1),
  }),
  edit_comment: z.object({
    commentId: z.string().min(1),
    segments: z.array(commentSegmentSchema).min(1),
  }),
  delete_comment: z.object({ commentId: z.string().min(1) }),

  get_workspace: z.object({}),
  create_workspace: z.object({
    name: z.string().trim().min(1).max(80),
    slug: z.string().trim().min(1).max(64).optional(),
  }),
  list_workspace_members: z.object({}),
  invite_workspace_member: z.object({
    email: z.string().email().max(254),
    role: organizationRoleSchema.default("org:member"),
  }),
  update_workspace_member_role: z.object({
    userId: z.string().min(1),
    role: organizationRoleSchema,
  }),
  remove_workspace_member: organizationConfirmation.extend({
    userId: z.string().min(1),
  }),
  delete_workspace: organizationConfirmation,

  get_sprint: z.object({ sprint: sprintRefSchema.default("current") }),
  list_sprint_tasks: z.object({
    sprint: sprintPlacementSchema.default("current"),
  }),
  sprint_history: z.object({
    cursor: z.string().nullable().optional(),
    pageSize: z.number().int().min(1).max(50).default(20),
    sprintId: z.string().min(1).optional(),
  }),
  plan_sprint_tasks: z.object({
    taskIds: z.array(z.string().min(1)).min(1).max(1000),
    sprint: sprintPlacementSchema,
  }),
  remove_sprint_tasks: z.object({
    taskIds: z.array(z.string().min(1)).min(1).max(1000),
    sprint: sprintRefSchema,
  }),
  update_sprint_goal: z.object({
    sprint: sprintRefSchema,
    goal: z.string().max(500).optional(),
  }),
  update_sprint_cadence: z.object({
    cadenceWeeks: z.number().int().min(1).max(8),
    startWeekday: z.number().int().min(0).max(6),
    timezone: z.string().min(1).max(100),
  }),
  rollover_sprint: organizationConfirmation.extend({
    reason: z.string().trim().min(1).max(500),
  }),
}

export const outputSchemas = {
  capture_task: z.object({
    taskId: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    title: z.string(),
    status: statusSchema,
    sprint: sprintPlacementSchema,
  }),
  move_task: z.object({ taskId: z.string(), status: statusSchema }),
  complete_task: z.object({ taskId: z.string(), status: statusSchema }),
  update_task: z.object({ taskId: z.string() }),
  delete_task: z.object({
    taskId: z.string(),
    deleted: z.boolean(),
    subtaskCount: z.number(),
    commentCount: z.number(),
  }),
  move_task_to_project: z.object({
    taskId: z.string(),
    projectId: z.string(),
    projectName: z.string(),
  }),
  create_project: z.object({ projectId: z.string(), name: z.string() }),
  update_project: z.object({ projectId: z.string() }),
  delete_project: z.object({ projectId: z.string(), deleted: z.boolean() }),
  create_subtask: z.object({ subtaskId: z.string(), taskId: z.string() }),
  rename_subtask: z.object({ subtaskId: z.string() }),
  set_subtask_completed: z.object({
    subtaskId: z.string(),
    completed: z.boolean(),
  }),
  reorder_subtask: z.object({ subtaskId: z.string() }),
  delete_subtask: z.object({ subtaskId: z.string(), deleted: z.boolean() }),
  create_comment: z.object({ commentId: z.string(), taskId: z.string() }),
  reply_to_comment: z.object({
    commentId: z.string(),
    parentCommentId: z.string(),
  }),
  edit_comment: z.object({ commentId: z.string() }),
  delete_comment: z.object({ commentId: z.string(), deleted: z.boolean() }),
  create_workspace: z.object({
    organizationId: z.string(),
    slug: z.string(),
    name: z.string(),
    requiresReauthorization: z.boolean(),
  }),
  invite_workspace_member: z.object({
    invitationId: z.string(),
    status: z.string(),
  }),
  update_workspace_member_role: z.object({
    userId: z.string(),
    role: organizationRoleSchema,
  }),
  remove_workspace_member: z.object({
    userId: z.string(),
    removed: z.boolean(),
  }),
  delete_workspace: z.object({ jobId: z.string(), deleting: z.boolean() }),
  plan_sprint_tasks: z.object({
    taskIds: z.array(z.string()),
    sprint: sprintPlacementSchema,
  }),
  remove_sprint_tasks: z.object({
    taskIds: z.array(z.string()),
    sprint: sprintRefSchema,
  }),
  update_sprint_goal: z.object({ sprint: sprintRefSchema }),
  update_sprint_cadence: z.object({
    cadenceWeeks: z.number(),
    startWeekday: z.number(),
    timezone: z.string(),
  }),
  rollover_sprint: z.object({ jobId: z.string(), started: z.boolean() }),
}
