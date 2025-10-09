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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { TopNavigation } from "@/components/TopNavigation";

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

export default function HiredTalentPortal() {
  const { user } = useAuth();

  const totalCalls = productivityData.inboundCalls + productivityData.outboundCalls;
  const currentMonthAttendance = attendanceData[attendanceData.length - 1].attendance;
  const currentMonthPerformance = monthlyPerformanceData[monthlyPerformanceData.length - 1].performance;

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      {/* Header */}
      <div className="border-b bg-card/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src="" alt={user?.firstName || "Talent"} />
                <AvatarFallback className="text-lg font-semibold bg-primary text-primary-foreground">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-talent-name">
                  {user?.firstName} {user?.lastName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Customer Support Specialist
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs" data-testid="badge-status">
                    Active
                  </Badge>
                  <Badge variant="outline" className="text-xs" data-testid="badge-shift">
                    Current Shift: 9:00 AM - 6:00 PM
                  </Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Overall Performance</div>
              <div className="text-3xl font-bold text-primary" data-testid="text-overall-score">
                {currentMonthPerformance}%
              </div>
            </div>
          </div>
        </div>
      </div>

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
                  <div className="text-3xl font-bold" data-testid="text-inbound-calls">
                    {productivityData.inboundCalls}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">This month</p>
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
                  <div className="text-3xl font-bold" data-testid="text-outbound-calls">
                    {productivityData.outboundCalls}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">This month</p>
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
                  <div className="text-3xl font-bold" data-testid="text-emails">
                    {productivityData.emails}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">This month</p>
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
                  <div className="text-3xl font-bold" data-testid="text-chats">
                    {productivityData.chats}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">This month</p>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
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
                    <Bar dataKey="attendance" fill="#10b981" name="Attendance %">
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
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
                    <Bar dataKey="performance" fill="#3b82f6" name="Performance %">
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
                      <div className="text-2xl font-bold" data-testid={`text-kpi-${kpi.id}`}>
                        {kpi.value}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Target: {kpi.target}</span>
                        <Badge
                          variant={kpi.status === "excellent" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {kpi.status === "excellent" ? "Exceeding" : "On Track"}
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
              <CardTitle className="text-base font-semibold">Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Total Interactions</div>
                  <div className="text-2xl font-bold" data-testid="text-total-interactions">
                    {totalCalls + productivityData.emails + productivityData.chats}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Across all channels this month
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Average Daily Output</div>
                  <div className="text-2xl font-bold" data-testid="text-daily-output">
                    {Math.round((totalCalls + productivityData.emails + productivityData.chats) / 30)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Interactions per working day
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Performance Trend</div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span className="text-2xl font-bold text-green-500" data-testid="text-trend">+7%</span>
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
    </div>
  );
}
