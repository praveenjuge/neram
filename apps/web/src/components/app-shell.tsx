"use client"

import { OrganizationSwitcher, RedirectToSignIn } from "@clerk/nextjs"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { useQuery } from "convex-helpers/react/cache"
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  Activity,
  Archive,
  LayoutDashboard,
  ListTodo,
  IterationCcw,
  MoreHorizontal,
  Pencil,
  Plus,
} from "lucide-react"
import { type ReactNode, useState } from "react"

import { api } from "@neram/convex/api"
import { AppUserButton } from "@/components/theme-toggle"
import {
  AddTaskDialog,
  ArchiveProjectDialog,
  EditProjectDialog,
  NewProjectDialog,
} from "@/components/project-dialogs"
import { DialogTrigger } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useProjectPrefetch } from "@/lib/prefetch"
import { getProjectColorText } from "@/lib/project-colors"
import { ProjectIcon } from "@/lib/project-icons"
import { workspaceHref } from "@/lib/workspace"

type SidebarProject = FunctionReturnType<typeof api.projects.names>[number]

type DialogKind = "add" | "edit" | "archive"

export function Protected({
  children,
  redirectUrl = "/",
}: {
  children: ReactNode
  redirectUrl?: string
}) {
  return (
    <>
      <AuthLoading>
        <main className="grid min-h-svh place-items-center p-6">
          <Spinner className="size-6 text-muted-foreground" />
        </main>
      </AuthLoading>
      <Unauthenticated>
        <RedirectToSignIn signInForceRedirectUrl={redirectUrl} />
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </>
  )
}

/**
 * The "⋯" menu on each project row. The dropdown only chooses which dialog to
 * open; the dialogs are rendered as siblings (not nested in the menu) so they
 * survive the dropdown closing and don't inherit its pointer-events handling.
 */
function ProjectActions({ project }: { project: SidebarProject }) {
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const onOpenChange = (next: boolean) => {
    if (!next) setDialog(null)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction aria-label={`${project.name} actions`} showOnHover>
            <MoreHorizontal />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" sideOffset={8}>
          <DropdownMenuItem onSelect={() => setDialog("add")}>
            <Plus /> Add task
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("edit")}>
            <Pencil /> Edit
          </DropdownMenuItem>
          {project.role === "org:admin" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDialog("archive")}>
                <Archive /> Archive
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AddTaskDialog
        id={project._id}
        name={project.name}
        onOpenChange={onOpenChange}
        open={dialog === "add"}
      />
      <EditProjectDialog
        color={project.color}
        icon={project.icon}
        id={project._id}
        name={project.name}
        onOpenChange={onOpenChange}
        open={dialog === "edit"}
        role={project.role}
      />
      {project.role === "org:admin" ? (
        <ArchiveProjectDialog
          id={project._id}
          name={project.name}
          onOpenChange={onOpenChange}
          open={dialog === "archive"}
        />
      ) : null}
    </>
  )
}

function ProjectMenuItem({
  project,
  isActive,
  organizationSlug,
}: {
  project: SidebarProject
  isActive: boolean
  organizationSlug: string
}) {
  const prefetch = useProjectPrefetch()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={project.name}>
        <Link
          href={workspaceHref(organizationSlug, `/projects/${project._id}`)}
          onFocus={() => prefetch(project._id)}
          onMouseEnter={() => prefetch(project._id)}
        >
          <ProjectIcon
            className={getProjectColorText(project.color)}
            name={project.icon}
          />
          <span>{project.name}</span>
        </Link>
      </SidebarMenuButton>
      {project.openCount > 0 ? (
        // Visible at rest; on desktop it yields to the action button on hover,
        // on mobile the action button is always shown so we hide the badge.
        <SidebarMenuBadge className="transition-opacity group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0 max-md:hidden">
          {project.openCount}
        </SidebarMenuBadge>
      ) : null}
      <ProjectActions project={project} />
    </SidebarMenuItem>
  )
}

function AppSidebar() {
  const projects = useQuery(api.projects.names)
  const params = useParams()
  const activeProjectId =
    typeof params.projectId === "string" ? params.projectId : undefined
  const pathname = usePathname()
  const organizationSlug =
    typeof params.organizationSlug === "string" ? params.organizationSlug : ""
  const dashboardHref = workspaceHref(organizationSlug)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex w-full items-center gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
              <OrganizationSwitcher
                afterCreateOrganizationUrl="/w/:slug/dashboard"
                afterSelectOrganizationUrl="/w/:slug/dashboard"
                hidePersonal
                appearance={{
                  elements: {
                    rootBox: "min-w-0 flex-1",
                    organizationSwitcherTrigger:
                      "w-full max-w-full !justify-start overflow-hidden",
                    organizationPreview: "min-w-0",
                    organizationPreviewTextContainer: "min-w-0",
                    organizationPreviewMainIdentifier: "truncate",
                  },
                }}
              />
              <AppUserButton />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === dashboardHref}
                  tooltip="Dashboard"
                >
                  <Link href={dashboardHref}>
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={
                    pathname === workspaceHref(organizationSlug, "/sprints")
                  }
                  tooltip="Sprints"
                >
                  <Link href={workspaceHref(organizationSlug, "/sprints")}>
                    <IterationCcw />
                    <span>Sprints</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={
                    pathname === workspaceHref(organizationSlug, "/tasks")
                  }
                  tooltip="Tasks"
                >
                  <Link href={workspaceHref(organizationSlug, "/tasks")}>
                    <ListTodo />
                    <span>Tasks</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={
                    pathname === workspaceHref(organizationSlug, "/activity")
                  }
                  tooltip="Activity"
                >
                  <Link href={workspaceHref(organizationSlug, "/activity")}>
                    <Activity />
                    <span>Activity</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={
                    pathname === workspaceHref(organizationSlug, "/archived")
                  }
                  tooltip="Archived"
                >
                  <Link href={workspaceHref(organizationSlug, "/archived")}>
                    <Archive />
                    <span>Archived</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <NewProjectDialog
            trigger={
              <DialogTrigger asChild>
                <SidebarGroupAction
                  aria-label="New project"
                  title="New project"
                >
                  <Plus />
                </SidebarGroupAction>
              </DialogTrigger>
            }
          />
          <SidebarGroupContent>
            <SidebarMenu>
              {projects === undefined ? (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                </>
              ) : projects.length === 0 ? (
                <li className="px-3 py-1.5 text-sm text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
                  No projects yet
                </li>
              ) : (
                projects.map((project) => (
                  <ProjectMenuItem
                    isActive={project._id === activeProjectId}
                    key={project._id}
                    organizationSlug={organizationSlug}
                    project={project}
                  />
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <SidebarTrigger />
          <span className="font-heading font-medium">Neram</span>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
