import { RedirectToSignIn, UserButton } from "@clerk/react"
import { Link, useLocation, useParams } from "@tanstack/react-router"
import { useQuery } from "convex-helpers/react/cache"
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  Activity,
  LayoutGrid,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react"
import { type ReactNode, useState } from "react"

import { api } from "../../convex/_generated/api"
import { ThemeMenuItem } from "@/components/theme-toggle"
import {
  AddTaskDialog,
  DeleteProjectDialog,
  EditProjectDialog,
  LeaveProjectDialog,
  NewProjectDialog,
  ShareProjectDialog,
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

type SidebarProject = FunctionReturnType<typeof api.projects.names>[number]

type DialogKind = "add" | "edit" | "share" | "leave" | "delete"

export function Protected({
  children,
  redirectUrl = "/dashboard",
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
          {project.role === "owner" ? (
            <>
              <DropdownMenuItem onSelect={() => setDialog("share")}>
                <Share2 /> Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDialog("delete")}
                variant="destructive"
              >
                <Trash2 /> Delete
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onSelect={() => setDialog("leave")}
              variant="destructive"
            >
              <LogOut /> Leave
            </DropdownMenuItem>
          )}
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
      {project.role === "owner" ? (
        <>
          <ShareProjectDialog
            id={project._id}
            name={project.name}
            onOpenChange={onOpenChange}
            open={dialog === "share"}
          />
          <DeleteProjectDialog
            id={project._id}
            name={project.name}
            onOpenChange={onOpenChange}
            open={dialog === "delete"}
          />
        </>
      ) : (
        <LeaveProjectDialog
          id={project._id}
          name={project.name}
          onOpenChange={onOpenChange}
          open={dialog === "leave"}
        />
      )}
    </>
  )
}

function ProjectMenuItem({
  project,
  isActive,
}: {
  project: SidebarProject
  isActive: boolean
}) {
  const prefetch = useProjectPrefetch()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={project.name}>
        <Link
          onFocus={() => prefetch(project._id)}
          onMouseEnter={() => prefetch(project._id)}
          params={{ projectId: project._id }}
          to="/projects/$projectId"
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
  const params = useParams({ strict: false })
  const activeProjectId = params.projectId
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center justify-between gap-2">
            <SidebarMenuButton asChild tooltip="Neram">
              <Link to="/dashboard">
                <Sparkles className="text-primary" />
                <span className="font-medium">Neram</span>
              </Link>
            </SidebarMenuButton>
            <UserButton />
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
                  isActive={pathname === "/dashboard"}
                  tooltip="All projects"
                >
                  <Link to="/dashboard">
                    <LayoutGrid />
                    <span>All projects</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/activity"}
                  tooltip="Activity"
                >
                  <Link to="/activity">
                    <Activity />
                    <span>Activity</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <ThemeMenuItem />
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
