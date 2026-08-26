import { 
  BarChart3, 
  Briefcase, 
  Calendar,
  DollarSign,
  FileText,
  Home, 
  Search, 
  Settings, 
  Users,
  Target,
  Shield,
  Upload,
  MessageSquare,
  Receipt,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { TopNavigation } from "@/components/TopNavigation";
import { useUnreadMessagesCount } from "@/hooks/useUnreadMessagesCount";

// Core Modules
const coreModules = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "Find Talent",
    url: "/hire-talent",
    icon: Search,
  },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
  },
  {
    title: "Interviews",
    url: "/client/interviews",
    icon: Calendar,
  },
  {
    title: "Projects",
    url: "/projects",
    icon: Briefcase,
  },
  {
    title: "Performance",
    url: "/performance",
    icon: BarChart3,
  },
];

// Management
const managementItems = [
  {
    title: "Team",
    url: "/clients",
    icon: Users,
  },
  {
    title: "Contracts",
    url: "/contracts",
    icon: FileText,
  },
  {
    title: "Payments",
    url: "/payments",
    icon: DollarSign,
  },
  {
    title: "Billing",
    url: "/client/billing",
    icon: Receipt,
  },
  {
    title: "ROI Analytics",
    url: "/roi",
    icon: Target,
  },
];

// System
const systemItems = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

// Admin Tools (only visible to admin users)
const adminItems = [
  {
    title: "CSV Import",
    url: "/admin/csv-import",
    icon: Upload,
  },
];

function ClientSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const unreadMessagesCount = useUnreadMessagesCount();
  const isActiveRoute = (url: string) =>
    location === url || (url !== "/dashboard" && location.startsWith(`${url}/`));

  return (
    <Sidebar className="client-portal-sidebar md:!top-0 md:!bottom-0 md:!h-svh">
      <div className="flex h-full min-h-0 flex-col">
        <div
          className="hidden shrink-0 md:block"
          style={{ height: "var(--nav-h)" }}
          aria-hidden="true"
        />
        <SidebarContent className="min-h-0 flex-1">
          {/* Core Modules */}
          <SidebarGroup>
            <SidebarGroupLabel>Core Modules</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {coreModules.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActiveRoute(item.url)}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span className="flex-1">{item.title}</span>
                        {item.title === "Messages" && unreadMessagesCount > 0 && (
                          <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                            {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Management */}
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {managementItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActiveRoute(item.url)}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* System */}
          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {systemItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActiveRoute(item.url)}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Admin Tools - Only visible to admin users */}
          {user?.role === 'admin' && (
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2">
                <Shield className="w-3 h-3" />
                Admin Tools
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActiveRoute(item.url)}>
                        <Link href={item.url} data-testid={`nav-admin-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
      </div>
    </Sidebar>
  );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const sidebarStyle = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNavigation />
      <SidebarProvider
        style={sidebarStyle}
        className="min-h-[calc(100svh-var(--nav-h))] items-stretch"
      >
        <ClientSidebar />
        <main className="min-h-[calc(100svh-var(--nav-h))] min-w-0 flex-1 p-4 sm:p-6">
          <div className="mb-4 flex md:hidden">
            <SidebarTrigger
              data-testid="button-sidebar-toggle"
              aria-label="Open client navigation"
            />
          </div>
          {children}
        </main>
      </SidebarProvider>
    </div>
  );
}
