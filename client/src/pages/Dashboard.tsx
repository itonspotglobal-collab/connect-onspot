import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bell,
  Plus,
  Award,
  BarChart3,
  Calendar,
  Briefcase,
  Target,
  Users,
  TrendingUp,
  Activity,
  Phone,
  MessageSquare,
  Star,
  Lightbulb,
  Settings,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const performanceData = [
  { month: "Jan", value: 72 },
  { month: "Feb", value: 78 },
  { month: "Mar", value: 65 },
  { month: "Apr", value: 85 },
  { month: "May", value: 80 },
  { month: "Jun", value: 90 },
];

const attendanceData = [
  { month: "Jan", value: 95 },
  { month: "Feb", value: 92 },
  { month: "Mar", value: 88 },
  { month: "Apr", value: 97 },
  { month: "May", value: 94 },
  { month: "Jun", value: 96 },
];

const projectsData = [
  { name: "Q1", Completed: 12, InProgress: 4 },
  { name: "Q2", Completed: 18, InProgress: 6 },
  { name: "Q3", Completed: 15, InProgress: 3 },
  { name: "Q4", Completed: 20, InProgress: 5 },
];

const channelData = [
  { channel: "Email", value: 340 },
  { channel: "Chat", value: 280 },
  { channel: "Phone", value: 210 },
  { channel: "Video", value: 140 },
];

const teamMembers = [
  { name: "Maria Santos", role: "Virtual Assistant", rating: 4.9, avatar: "" },
  { name: "James Reyes", role: "Customer Support", rating: 4.7, avatar: "" },
  { name: "Ana Cruz", role: "Data Analyst", rating: 4.8, avatar: "" },
  { name: "Carlo Diaz", role: "Tech Support", rating: 4.6, avatar: "" },
];

const momData = [
  { month: "Jan", AHT: 68, Quality: 82, CSAT: 77 },
  { month: "Feb", AHT: 72, Quality: 85, CSAT: 80 },
  { month: "Mar", AHT: 65, Quality: 79, CSAT: 74 },
  { month: "Apr", AHT: 78, Quality: 88, CSAT: 84 },
  { month: "May", AHT: 75, Quality: 86, CSAT: 82 },
  { month: "Jun", AHT: 80, Quality: 90, CSAT: 87 },
];

const attendanceSummary = [
  { name: "Maria Santos", pct: 98 },
  { name: "James Reyes", pct: 94 },
  { name: "Ana Cruz", pct: 96 },
  { name: "Carlo Diaz", pct: 91 },
  { name: "Lisa Tan", pct: 99 },
];

const csatData = [
  { month: "Jan", score: 4.1 },
  { month: "Feb", score: 4.3 },
  { month: "Mar", score: 4.0 },
  { month: "Apr", score: 4.5 },
  { month: "May", score: 4.4 },
  { month: "Jun", score: 4.7 },
];

const callsData = [
  { month: "Jan", Inbound: 320, Outbound: 210 },
  { month: "Feb", Inbound: 380, Outbound: 260 },
  { month: "Mar", Inbound: 290, Outbound: 190 },
  { month: "Apr", Inbound: 420, Outbound: 310 },
  { month: "May", Inbound: 400, Outbound: 290 },
  { month: "Jun", Inbound: 450, Outbound: 340 },
];

const scorecardData = [
  { name: "Maria S.", Attendance: 98, CSAT: 92, Productivity: 88, AHT: 75 },
  { name: "James R.", Attendance: 94, CSAT: 85, Productivity: 80, AHT: 70 },
  { name: "Ana C.", Attendance: 96, CSAT: 90, Productivity: 85, AHT: 78 },
  { name: "Carlo D.", Attendance: 91, CSAT: 82, Productivity: 76, AHT: 68 },
  { name: "Lisa T.", Attendance: 99, CSAT: 95, Productivity: 91, AHT: 82 },
];

const feedbackRows = [
  { feedback: "-", date: "-", coachingDate: "-", rca: "-", actionPlan: "-" },
  { feedback: "-", date: "-", coachingDate: "-", rca: "-", actionPlan: "-" },
  { feedback: "-", date: "-", coachingDate: "-", rca: "-", actionPlan: "-" },
];

const fourP = [
  {
    key: "PHILOSOPHY",
    color: "blue",
    icon: Lightbulb,
    bg: "bg-blue-50 dark:bg-blue-950/30",
    iconBg: "bg-blue-100 dark:bg-blue-900/50",
    iconColor: "text-blue-600 dark:text-blue-400",
    title: "PHILOSOPHY",
    body: "We believe in building long-term partnerships rooted in trust, transparency, and mutual growth.",
    bullets: [
      "What values drive our partnership?",
      "How do we align on long-term goals?",
      "What does success look like for both sides?",
    ],
  },
  {
    key: "PEOPLE",
    color: "green",
    icon: Users,
    bg: "bg-green-50 dark:bg-green-950/30",
    iconBg: "bg-green-100 dark:bg-green-900/50",
    iconColor: "text-green-600 dark:text-green-400",
    title: "PEOPLE",
    body: "Our rigorous vetting process ensures only top-tier talent joins your team.",
    bullets: [
      "How do we match talent to your culture?",
      "What is our onboarding process?",
      "How do we retain high performers?",
    ],
  },
  {
    key: "PROBLEM SOLVING",
    color: "purple",
    icon: Target,
    bg: "bg-purple-50 dark:bg-purple-950/30",
    iconBg: "bg-purple-100 dark:bg-purple-900/50",
    iconColor: "text-purple-600 dark:text-purple-400",
    title: "PROBLEM SOLVING",
    body: "Data-driven approach to resolving challenges and continuously improving team performance.",
    bullets: [
      "How do we identify root causes?",
      "What metrics guide our decisions?",
      "How quickly do we respond to issues?",
    ],
  },
  {
    key: "PROCESS",
    color: "orange",
    icon: Settings,
    bg: "bg-orange-50 dark:bg-orange-950/30",
    iconBg: "bg-orange-100 dark:bg-orange-900/50",
    iconColor: "text-orange-600 dark:text-orange-400",
    title: "PROCESS",
    body: "Structured workflows that ensure consistency, quality, and scalability at every stage.",
    bullets: [
      "What SOPs govern daily operations?",
      "How do we document and improve?",
      "What QA mechanisms are in place?",
    ],
  },
];

const insights = [
  {
    dot: "bg-blue-500",
    label: "Philippine Talent Pool Alert",
    desc: "15 pre-vetted specialists ready from a 50,000+ curated talent pool, matched to your open roles.",
    badge: "High Priority",
    badgeVariant: "default" as const,
    badgeCls: "bg-blue-600 text-white",
  },
  {
    dot: "bg-green-500",
    label: "Cost Savings Opportunity",
    desc: "Switch to Managed Services and realise up to 70% cost savings compared to local hiring.",
    badge: "Medium Priority",
    badgeVariant: "outline" as const,
    badgeCls: "border-green-500 text-green-600 dark:text-green-400",
  },
  {
    dot: "bg-purple-500",
    label: "Growth Potential",
    desc: "Clients using the 4P System report up to 8× business growth within 12 months.",
    badge: "Opportunity",
    badgeVariant: "outline" as const,
    badgeCls: "border-purple-500 text-purple-600 dark:text-purple-400",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ─── Section: Small chart card ────────────────────────────────────────────────

function MiniCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0">{children}</CardContent>
    </Card>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [perfFilter, setPerfFilter] = useState("monthly");

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* ── 1. Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome to OnSpot</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Making Outsourcing Easy — Built by entrepreneurs, for entrepreneurs. Cut costs by up to 70% and fuel 8× business growth.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>
        </div>

        {/* ── 2. Stats Tagline Bar ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
          {[
            "Hundreds of clients",
            "Thousands of talents",
            "Fastest onboarding in the market",
          ].map((item, i) => (
            <span
              key={i}
              className="rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground"
            >
              {item}
            </span>
          ))}
        </div>

        {/* ── 3. Performance Summary + Our People ──────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Performance Summary — 2/3 */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Performance Summary</CardTitle>
              </div>
              <Select value={perfFilter} onValueChange={setPerfFilter}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Performance Average */}
                <MiniCard icon={BarChart3} title="Performance Average">
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={performanceData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#a855f7" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </MiniCard>

                {/* Attendance % */}
                <MiniCard icon={Calendar} title="Attendance %">
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={attendanceData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#10b981" radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="value" position="top" style={{ fontSize: 9 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </MiniCard>

                {/* Projects Overview */}
                <MiniCard icon={Briefcase} title="Projects Overview">
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={projectsData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={24} />
                      <Tooltip />
                      <Bar dataKey="Completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="InProgress" stackId="a" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </MiniCard>

                {/* Work Distribution */}
                <MiniCard icon={Target} title="Work Distribution">
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={channelData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="channel" type="category" tick={{ fontSize: 10 }} width={38} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                        {channelData.map((_, i) => (
                          <rect
                            key={i}
                            fill={["#6366f1", "#3b82f6", "#10b981", "#f59e0b"][i]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </MiniCard>
              </div>
            </CardContent>
          </Card>

          {/* Our People — 1/3 */}
          <Card className="lg:col-span-1 flex flex-col">
            <CardHeader className="flex flex-row items-center gap-2 pb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Our People</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4">
              <div className="space-y-4">
                {teamMembers.map((m) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={m.avatar} alt={m.name} />
                      <AvatarFallback className="text-xs font-semibold bg-muted">
                        {initials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.role}</p>
                    </div>
                    <span className="flex items-center gap-1 shrink-0 rounded-full bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <Star className="h-3 w-3 fill-current" />
                      {m.rating}
                    </span>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="w-full mt-2 rounded-full text-xs">
                View All Talent
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── 4. KPI Section — 2×2 grid ────────────────────────────────────── */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Month on Month Performance */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Month on Month Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={momData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="AHT" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Quality" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="CSAT" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Individual Attendance Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Individual Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {attendanceSummary.map((a) => (
                  <div key={a.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{a.name}</span>
                      <span className="text-muted-foreground">{a.pct}%</span>
                    </div>
                    <Progress
                      value={a.pct}
                      className="h-1.5 [&>div]:bg-green-500"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Client Satisfaction */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Client Satisfaction</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={csatData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Calls Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Calls Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={callsData} margin={{ top: 14, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Inbound" fill="#3b82f6" radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="Inbound" position="top" style={{ fontSize: 8 }} />
                  </Bar>
                  <Bar dataKey="Outbound" fill="#ec4899" radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="Outbound" position="top" style={{ fontSize: 8 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* ── 5. Talent Performance ─────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Talent Scorecard */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Award className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Talent Scorecard</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={scorecardData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} label={{ value: "Performance %", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Attendance" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="CSAT" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Productivity" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="AHT" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Client Feedback Table */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Client Feedback / Call Out and Coaching</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feedback</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Coaching Date</TableHead>
                      <TableHead>RCA</TableHead>
                      <TableHead>Action Plan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedbackRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{row.feedback}</TableCell>
                        <TableCell className="text-muted-foreground">{row.date}</TableCell>
                        <TableCell className="text-muted-foreground">{row.coachingDate}</TableCell>
                        <TableCell className="text-muted-foreground">{row.rca}</TableCell>
                        <TableCell className="text-muted-foreground">{row.actionPlan}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── 6. The OnSpot Experience — FourP System ──────────────────────── */}
        <div className="space-y-6">
          <h2 className="text-center text-xl font-bold text-foreground">
            The OnSpot Experience
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {fourP.map((p) => {
              const Icon = p.icon;
              return (
                <Card key={p.key} className={p.bg}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${p.iconBg}`}>
                        <Icon className={`h-5 w-5 ${p.iconColor}`} />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="text-sm font-bold tracking-widest text-foreground">
                          {p.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {p.body}
                        </p>
                        <ul className="space-y-1">
                          {p.bullets.map((b) => (
                            <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${p.iconBg} ${p.iconColor}`} />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ── 7. Insights & Recommendations ───────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">OnSpot Insights &amp; Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {insights.map((ins, i) => (
                <div key={i} className="flex flex-wrap items-start gap-3 py-4 first:pt-0 last:pb-0">
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${ins.dot}`} />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">{ins.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{ins.desc}</p>
                  </div>
                  <Badge
                    variant={ins.badgeVariant}
                    className={`shrink-0 text-xs ${ins.badgeCls}`}
                  >
                    {ins.badge}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
