export type BacklogTask = {
  title: string
  projectName: string
  position: number
}

export function groupBacklogTasks<T extends BacklogTask>(
  tasks: T[],
  search: string
) {
  const needle = search.trim().toLocaleLowerCase()
  const groups = new Map<string, T[]>()
  for (const task of tasks) {
    if (
      needle &&
      !`${task.title} ${task.projectName}`.toLocaleLowerCase().includes(needle)
    ) {
      continue
    }
    const projectTasks = groups.get(task.projectName) ?? []
    projectTasks.push(task)
    groups.set(task.projectName, projectTasks)
  }
  for (const projectTasks of groups.values()) {
    projectTasks.sort((left, right) => left.position - right.position)
  }
  return [...groups.entries()]
}

export function findOrganizationBySlug<
  T extends { organization: { slug?: string | null } },
>(memberships: T[] | undefined, slug: string) {
  return memberships?.find(
    (membership) => membership.organization.slug === slug
  )
}
