import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import {
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  TrendingUp,
  Target,
  Award,
  Clock,
  CheckCircle,
  Activity,
  Home,
  Search,
  Briefcase,
  FileText,
  Settings,
  User,
  Loader2,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
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

// Sidebar Menu Items
const coreModules = [
  {
    title: "Dashboard",
    url: "/hired-talent-portal",
    icon: Home,
  },
  {
    title: "OnSpot Talent",
    url: "/hired-talent-portal/talent",
    icon: Search,
  },
  {
    title: "Client Projects",
    url: "/hired-talent-portal/projects",
    icon: Briefcase,
  },
];

const managementItems = [
  {
    title: "Contracts",
    url: "/hired-talent-portal/contracts",
    icon: FileText,
  },
];

const systemItems = [
  {
    title: "Profile Settings",
    url: "/settings",
    icon: Settings,
  },
];

// Sample data for monthly performance
const monthlyPerformanceData = [
  { month: "Jan", performance: 85 },
  { month: "Feb", performance: 88 },
  { month: "Mar", performance: 92 },
  { month: "Apr", performance: 90 },
  { month: "May", performance: 95 },
  { month: "Jun", performance: 93 },
];

// Sample data for productivity summary
const productivityData = {
  inboundCalls: 245,
  outboundCalls: 180,
  emails: 320,
  chats: 156,
};

// Sample attendance data
const attendanceData = [
  { month: "Jan", attendance: 95 },
  { month: "Feb", attendance: 98 },
  { month: "Mar", attendance: 96 },
  { month: "Apr", attendance: 100 },
  { month: "May", attendance: 97 },
  { month: "Jun", attendance: 99 },
];

// KPI data
const kpiMetrics = [
  {
    id: "response-time",
    label: "Avg Response Time",
    value: "2.3 min",
    target: "< 3 min",
    status: "excellent",
    icon: Clock,
  },
  {
    id: "satisfaction",
    label: "Customer Satisfaction",
    value: "4.8/5.0",
    target: "≥ 4.5",
    status: "excellent",
    icon: Award,
  },
  {
    id: "resolution",
    label: "First Call Resolution",
    value: "87%",
    target: "≥ 80%",
    status: "excellent",
    icon: CheckCircle,
  },
  {
    id: "productivity",
    label: "Productivity Score",
    value: "93%",
    target: "≥ 85%",
    status: "excellent",
    icon: TrendingUp,
  },
];

function TalentSidebar() {
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
                    <Link
                      href={item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
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
                    <Link
                      href={item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
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
                    <Link
                      href={item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
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

export default function HiredTalentPortal() {
  const { user, logout, isLoading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const totalCalls =
    productivityData.inboundCalls + productivityData.outboundCalls;
  const currentMonthAttendance =
    attendanceData[attendanceData.length - 1].attendance;
  const currentMonthPerformance =
    monthlyPerformanceData[monthlyPerformanceData.length - 1].performance;

  const sidebarStyle = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      console.log("✅ User logged out successfully from talent portal");
    } catch (error) {
      console.error("❌ Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <TalentSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Link href="/hired-talent-portal" className="flex items-center space-x-2">
                <div className="font-semibold text-lg text-primary">OnSpot</div>
                <div className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
                  Talent Portal
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
                       user.firstName || user.username || user.email.split("@")[0]}
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
          <main className="flex-1 overflow-auto">
            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-8">
                  {/* Productivity Summary */}
                  <section>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Productivity Summary
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="overflow-hidden">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Phone className="h-4 w-4 text-blue-500" />
                            Inbound Calls
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div
                            className="text-3xl font-bold"
                            data-testid="text-inbound-calls"
                          >
                            {productivityData.inboundCalls}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            This month
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="overflow-hidden">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Phone className="h-4 w-4 text-pink-500" />
                            Outbound Calls
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div
                            className="text-3xl font-bold"
                            data-testid="text-outbound-calls"
                          >
                            {productivityData.outboundCalls}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            This month
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="overflow-hidden">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Mail className="h-4 w-4 text-yellow-500" />
                            Emails
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div
                            className="text-3xl font-bold"
                            data-testid="text-emails"
                          >
                            {productivityData.emails}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            This month
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="overflow-hidden">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-green-500" />
                            Chats
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div
                            className="text-3xl font-bold"
                            data-testid="text-chats"
                          >
                            {productivityData.chats}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            This month
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </section>

                  {/* Performance Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Attendance Chart */}
                    <Card className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 font-semibold">
                          <Calendar className="h-4 w-4" />
                          Attendance Tracking
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Current: {currentMonthAttendance}%
                        </p>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={attendanceData}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#e5e7eb"
                            />
                            <XAxis
                              dataKey="month"
                              stroke="#6b7280"
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis
                              stroke="#6b7280"
                              tick={{ fontSize: 11 }}
                              domain={[0, 100]}
                            />
                            <Tooltip />
                            <Bar
                              dataKey="attendance"
                              fill="#10b981"
                              name="Attendance %"
                            >
                              <LabelList
                                dataKey="attendance"
                                position="top"
                                style={{ fontSize: "10px" }}
                                formatter={(value: number) => `${value}%`}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Monthly Performance Chart */}
                    <Card className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 font-semibold">
                          <TrendingUp className="h-4 w-4" />
                          Monthly Performance
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Current: {currentMonthPerformance}%
                        </p>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={monthlyPerformanceData}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#e5e7eb"
                            />
                            <XAxis
                              dataKey="month"
                              stroke="#6b7280"
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis
                              stroke="#6b7280"
                              tick={{ fontSize: 11 }}
                              domain={[0, 100]}
                            />
                            <Tooltip />
                            <Bar
                              dataKey="performance"
                              fill="#3b82f6"
                              name="Performance %"
                            >
                              <LabelList
                                dataKey="performance"
                                position="top"
                                style={{ fontSize: "10px" }}
                                formatter={(value: number) => `${value}%`}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* KPI Metrics */}
                  <section>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Key Performance Indicators (KPIs)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {kpiMetrics.map((kpi) => (
                        <Card key={kpi.id} className="overflow-hidden">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <kpi.icon className="h-4 w-4 text-primary" />
                              {kpi.label}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div
                                className="text-2xl font-bold"
                                data-testid={`text-kpi-${kpi.id}`}
                              >
                                {kpi.value}
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">
                                  Target: {kpi.target}
                                </span>
                                <Badge
                                  variant={
                                    kpi.status === "excellent"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {kpi.status === "excellent"
                                    ? "Exceeding"
                                    : "On Track"}
                                </Badge>
                              </div>
                              <Progress value={95} className="h-2" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>

                  {/* Summary Stats */}
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold">
                        Performance Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            Total Interactions
                          </div>
                          <div
                            className="text-2xl font-bold"
                            data-testid="text-total-interactions"
                          >
                            {totalCalls +
                              productivityData.emails +
                              productivityData.chats}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Across all channels this month
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            Average Daily Output
                          </div>
                          <div
                            className="text-2xl font-bold"
                            data-testid="text-daily-output"
                          >
                            {Math.round(
                              (totalCalls +
                                productivityData.emails +
                                productivityData.chats) /
                                30,
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Interactions per working day
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            Performance Trend
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-500" />
                            <span
                              className="text-2xl font-bold text-green-500"
                              data-testid="text-trend"
                            >
                              +7%
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Compared to last month
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
  );
}
