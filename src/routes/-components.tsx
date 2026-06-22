import { RedirectToSignIn, UserButton } from "@clerk/react"
import { Link, useLocation, useParams } from "@tanstack/react-router"
import { useQuery } from "convex-helpers/react/cache"
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import { FolderKanban, LayoutGrid } from "lucide-react"
import type { ReactNode } from "react"

import { api } from "../../convex/_generated/api"
import { ThemeToggle } from "@/components/theme-toggle"
import { Spinner } from "@/components/ui/spinner"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useProjectPrefetch } from "@/lib/prefetch"

export function Protected({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <main className="grid min-h-svh place-items-center p-6">
          <Spinner className="size-6 text-muted-foreground" />
        </main>
      </AuthLoading>
      <Unauthenticated>
        <RedirectToSignIn signInForceRedirectUrl="/dashboard" />
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </>
  )
}

function AppSidebar({ actions }: { actions?: ReactNode }) {
  const projects = useQuery(api.projects.names)
  const prefetch = useProjectPrefetch()
  const params = useParams({ strict: false })
  const activeProjectId = params.projectId
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link to="/dashboard">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary font-heading font-medium text-primary-foreground">
                  N
                </span>
                <span className="font-heading text-base font-medium">
                  Neram
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {actions ? (
          <SidebarGroup className="[&_button]:w-full">{actions}</SidebarGroup>
        ) : null}
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/dashboard"}>
                  <Link to="/dashboard">
                    <LayoutGrid />
                    <span>All projects</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {projects === undefined ? (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                </>
              ) : (
                projects.map((project) => (
                  <SidebarMenuItem key={project._id}>
                    <SidebarMenuButton
                      asChild
                      isActive={project._id === activeProjectId}
                      tooltip={project.name}
                    >
                      <Link
                        onFocus={() => prefetch(project._id)}
                        onMouseEnter={() => prefetch(project._id)}
                        params={{ projectId: project._id }}
                        to="/projects/$projectId"
                      >
                        <FolderKanban />
                        <span>{project.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-1">
          <UserButton />
          <ThemeToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export function AppLayout({
  actions,
  children,
}: {
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar actions={actions} />
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
