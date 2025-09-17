import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Briefcase, 
  DollarSign, 
  FileText, 
  Home, 
  Search, 
  Settings, 
  Users,
  Target,
  TrendingUp,
  LogOut,
  User,
  Loader2
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
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
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";

// Core Modules
const coreModules = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "OnSpot Talent",
    url: "/talent",
    icon: Search,
  },
  {
    title: "Client Projects",
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
    title: "Client Management",
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

function ClientSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarContent>
        {/* Core Modules */}
        <SidebarGroup>
          <SidebarGroupLabel>Core Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {coreModules.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
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

        {/* Management */}
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
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
                  <SidebarMenuButton asChild isActive={location === item.url}>
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
      </SidebarContent>
    </Sidebar>
  );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const sidebarStyle = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;
  
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      console.log('✅ User logged out successfully from client layout');
    } catch (error) {
      console.error('❌ Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <ClientSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Link href="/dashboard" className="flex items-center space-x-2">
                <div className="font-semibold text-lg text-primary">OnSpot</div>
                <div className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
                  Client Portal
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {/* User Information */}
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="user-loading">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : user ? (
                <div className="flex items-center gap-2 text-sm" data-testid="user-info">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || user.email} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {user.firstName ? user.firstName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 
                       user.firstName || user.username || user.email.split('@')[0]}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {user.userType || user.role}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="user-not-found">
                  <User className="w-4 h-4" />
                  <span>User not found</span>
                </div>
              )}
              
              <ThemeToggle />
              
              {/* Logout Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut || isLoading}
                data-testid="button-logout"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Logging out...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </>
                )}
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}