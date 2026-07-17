import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bell, Plus, Clock, Calendar, DollarSign, FileText, Download, Eye,
  Users, MessageSquare, CalendarCheck, AlertCircle, CheckCircle,
  TrendingUp, BarChart3, Send, ChevronRight, Briefcase,
  ClockIcon, Coffee, Palmtree, RotateCcw, UserPlus, Shuffle,
  Timer, ThumbsUp, CheckSquare, Upload, Phone, Video,
  Circle, Inbox, FileCheck, FolderOpen, Star, Activity,
  Bot, Loader2, ArrowUp, ArrowDown,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import avatarImage from "@assets/generated_images/Professional_talent_avatar_71613d75.png";

// ── Brand color ─────────────────────────────────────────────────────────────
const PURPLE = "#6D5EF7";

// ── Mock data ────────────────────────────────────────────────────────────────
const va = {
  name: "Maria Santos",
  position: "Executive Virtual Assistant",
  status: "online" as "online" | "offline" | "break" | "pto",
  photo: avatarImage,
  employedSince: "Jan 15, 2024",
};

const todaySchedule = {
  currentTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  timeIn: "8:02 AM",
  timeOut: "—",
  hoursToday: 4.5,
  hoursWeek: 22.5,
  hoursMonth: 89,
};

const attendance = {
  ptoBalance: 8,
  holidays: 2,
  approvedLeaves: 1,
  overtimeHours: 6.5,
  attendancePct: 96,
  breakDuration: "45 min",
  weeklyData: [
    { day: "Mon", hours: 8, present: true },
    { day: "Tue", hours: 8.5, present: true },
    { day: "Wed", hours: 7, present: true },
    { day: "Thu", hours: 8, present: true },
    { day: "Fri", hours: 4.5, present: true },
  ],
};

const financial = {
  currentInvoice: { number: "INV-2025-0047", amount: 2400, status: "pending", dueDate: "Jul 30, 2025" },
  nextBilling: "Aug 1, 2025",
  monthlyCost: 2400,
  deposit: 1200,
  history: [
    { date: "Jun 1, 2025", period: "May 2025", amount: 2400, paid: "Jun 5, 2025" },
    { date: "May 1, 2025", period: "Apr 2025", amount: 2400, paid: "May 4, 2025" },
    { date: "Apr 1, 2025", period: "Mar 2025", amount: 2400, paid: "Apr 3, 2025" },
    { date: "Mar 1, 2025", period: "Feb 2025", amount: 2400, paid: "Mar 6, 2025" },
  ],
};

const contacts = [
  { name: "Nur Laminero", role: "CEO", initials: "NL", color: "#6D5EF7" },
  { name: "Odie Galang", role: "Delivery Manager", initials: "OG", color: "#3B82F6" },
  { name: "Odie Galang", role: "Billing", initials: "OG", color: "#10B981" },
  { name: "Mark Anthony Apostol", role: "Recruitment & HR", initials: "MA", color: "#F59E0B" },
];

const notifications = [
  { id: 1, icon: CheckCircle, type: "success", msg: "Maria Santos clocked in at 8:02 AM", time: "2h ago", read: false },
  { id: 2, icon: FileText, type: "info", msg: "Invoice INV-2025-0047 generated", time: "1d ago", read: false },
  { id: 3, icon: Calendar, type: "warning", msg: "Invoice due in 7 days — $2,400", time: "1d ago", read: false },
  { id: 4, icon: CheckCircle, type: "success", msg: "PTO request approved (Jul 25)", time: "2d ago", read: true },
  { id: 5, icon: Upload, type: "info", msg: "New document uploaded: Q2 Report", time: "3d ago", read: true },
  { id: 6, icon: CheckCircle, type: "success", msg: "Maria Santos clocked out at 5:01 PM", time: "1d ago", read: true },
];

const vanessaPrompts = [
  "How many hours has my VA worked this week?",
  "When is my next billing date?",
  "How many PTO days remain?",
  "Show invoices from the last 6 months",
];

const hoursChart = [
  { week: "W1", hours: 40 }, { week: "W2", hours: 38 },
  { week: "W3", hours: 42 }, { week: "W4", hours: 35 },
  { week: "W5", hours: 40 }, { week: "W6", hours: 44 },
];

const billingChart = [
  { month: "Feb", amount: 2400 }, { month: "Mar", amount: 2400 },
  { month: "Apr", amount: 2400 }, { month: "May", amount: 2400 },
  { month: "Jun", amount: 2400 }, { month: "Jul", amount: 2400 },
];

const attendancePieData = [
  { name: "Present", value: 96 }, { name: "Absent", value: 4 },
];
const PIE_COLORS = [PURPLE, "#E2E8F0"];

const performanceChart = [
  { month: "Feb", score: 91 }, { month: "Mar", score: 93 },
  { month: "Apr", score: 89 }, { month: "May", score: 95 },
  { month: "Jun", score: 94 }, { month: "Jul", score: 96 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: "online" | "offline" | "break" | "pto" }) {
  const map = {
    online: { label: "Online", color: "#10B981", bg: "#D1FAE5" },
    offline: { label: "Offline", color: "#EF4444", bg: "#FEE2E2" },
    break: { label: "On Break", color: "#F59E0B", bg: "#FEF3C7" },
    pto: { label: "PTO", color: "#6D5EF7", bg: "#EDE9FE" },
  };
  const { label, color, bg } = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ color, background: bg }}>
      <Circle className="w-2 h-2 fill-current" />
      {label}
    </span>
  );
}

function StatRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800">
        {value} {sub && <span className="font-normal text-slate-400 text-xs">{sub}</span>}
      </span>
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {action}
    </div>
  );
}

// ── Vanessa AI Chat ───────────────────────────────────────────────────────────
function VanessaChat() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! I'm Vanessa, your OnSpot AI assistant. Ask me anything about your account." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg) return;
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      const replies: Record<string, string> = {
        "how many hours has my va worked this week?": "Maria has worked 22.5 hours this week (Mon–Thu). She's on track for a full 40-hour week.",
        "when is my next billing date?": "Your next billing date is August 1, 2025. The invoice will be for $2,400.",
        "how many pto days remain?": "Maria has 8 PTO days remaining for this year.",
        "show invoices from the last 6 months": "Here's a summary:\n• Jul 2025 — $2,400 (Pending)\n• Jun 2025 — $2,400 (Paid)\n• May 2025 — $2,400 (Paid)\n• Apr 2025 — $2,400 (Paid)\n• Mar 2025 — $2,400 (Paid)\n• Feb 2025 — $2,400 (Paid)",
      };
      const lower = msg.toLowerCase();
      const reply = replies[lower] || "Great question! Let me pull that information for you. For detailed data, please check the relevant section on your dashboard or contact your Delivery Manager.";
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
      setLoading(false);
    }, 1000);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1" style={{ maxHeight: 260 }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "assistant" && (
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: PURPLE }}>
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div className={`text-xs rounded-2xl px-3 py-2 max-w-[85%] leading-relaxed whitespace-pre-line ${
              m.role === "user"
                ? "text-white rounded-tr-sm"
                : "bg-slate-50 text-slate-700 rounded-tl-sm border border-slate-100"
            }`} style={m.role === "user" ? { background: PURPLE } : {}}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: PURPLE }}>
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-3 py-2 border border-slate-100">
              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
            </div>
          </div>
        )}
      </div>
      {/* Suggested prompts */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {vanessaPrompts.slice(0, 2).map((p) => (
          <button key={p} onClick={() => sendMessage(p)}
            className="text-[11px] px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-purple-300 hover:text-purple-700 transition-colors bg-white">
            {p}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Vanessa anything…"
          className="text-xs h-9 rounded-xl border-slate-200 bg-slate-50 focus:ring-1 focus:ring-purple-400"
          onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
        <Button size="icon" onClick={() => sendMessage()}
          className="h-9 w-9 rounded-xl flex-shrink-0" style={{ background: PURPLE }}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<string | null>(null);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const clientName = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : user?.username || "there";

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-full bg-[#F8FAFF]">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}, {clientName} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button variant="outline" size="icon" className="rounded-xl border-slate-200"
              onClick={() => setNotifOpen(v => !v)}>
              <Bell className="w-4 h-4 text-slate-600" />
            </Button>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                style={{ background: "#EF4444" }}>
                {unreadCount}
              </span>
            )}
          </div>
          <Button className="rounded-xl gap-1.5 text-sm font-medium" style={{ background: PURPLE }}>
            <Plus className="w-4 h-4" /> New Request
          </Button>
        </div>
      </div>

      {/* ── Main 2-column grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ══ LEFT/MAIN COLUMN (2/3) ══════════════════════════════════════ */}
        <div className="xl:col-span-2 space-y-5">

          {/* Section 1 — At a Glance */}
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              {/* VA banner */}
              <div className="flex items-center gap-4 p-5 border-b border-slate-100"
                style={{ background: "linear-gradient(135deg, #F5F3FF 0%, #EEF2FF 100%)" }}>
                <Avatar className="w-14 h-14 ring-2 ring-white shadow">
                  <AvatarImage src={va.photo} alt={va.name} />
                  <AvatarFallback style={{ background: PURPLE, color: "#fff" }}>MS</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{va.name}</h3>
                    <StatusBadge status={va.status} />
                  </div>
                  <p className="text-sm text-slate-500">{va.position}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Employed since {va.employedSince}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Today</p>
                  <p className="text-2xl font-bold text-slate-900 leading-tight">{todaySchedule.currentTime}</p>
                </div>
              </div>

              {/* Schedule KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-slate-100">
                {[
                  { label: "Time In", value: todaySchedule.timeIn },
                  { label: "Time Out", value: todaySchedule.timeOut },
                  { label: "Today", value: `${todaySchedule.hoursToday}h` },
                  { label: "This Week", value: `${todaySchedule.hoursWeek}h` },
                  { label: "This Month", value: `${todaySchedule.hoursMonth}h` },
                ].map(({ label, value }) => (
                  <div key={label} className="p-4 text-center">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-base font-bold text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section 2 — Attendance */}
          <Card className="border-slate-200 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <SectionHeader title="Attendance Dashboard" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Left: stats */}
                <div className="space-y-0.5">
                  <StatRow label="Daily Time In" value={todaySchedule.timeIn} />
                  <StatRow label="Daily Time Out" value={todaySchedule.timeOut === "—" ? "In progress" : todaySchedule.timeOut} />
                  <StatRow label="Break Duration" value={attendance.breakDuration} />
                  <StatRow label="PTO Balance" value={attendance.ptoBalance} sub="days" />
                  <StatRow label="Holidays This Month" value={attendance.holidays} />
                  <StatRow label="Approved Leaves" value={attendance.approvedLeaves} />
                  <StatRow label="Overtime Hours" value={`${attendance.overtimeHours}h`} />
                </div>

                {/* Right: attendance gauge + weekly */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-500">Attendance Rate</span>
                      <span className="text-sm font-bold text-slate-800">{attendance.attendancePct}%</span>
                    </div>
                    <Progress value={attendance.attendancePct} className="h-2 rounded-full" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">This Week</p>
                    <div className="flex gap-2">
                      {attendance.weeklyData.map((d) => (
                        <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full rounded-lg text-center py-1.5 text-xs font-semibold text-white"
                            style={{ background: d.present ? PURPLE : "#E2E8F0", color: d.present ? "#fff" : "#94A3B8" }}>
                            {d.hours}h
                          </div>
                          <span className="text-[11px] text-slate-400">{d.day}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* mini pie */}
                  <div className="flex items-center gap-3">
                    <ResponsiveContainer width={64} height={64}>
                      <PieChart>
                        <Pie data={attendancePieData} dataKey="value" cx="50%" cy="50%" innerRadius={20} outerRadius={30} stroke="none">
                          {attendancePieData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: PURPLE }} />
                        <span className="text-slate-600">Present 96%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-200" />
                        <span className="text-slate-600">Absent 4%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3 — Financial Overview */}
          <Card className="border-slate-200 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <SectionHeader title="Financial Overview" />
            </CardHeader>
            <CardContent>
              {/* Current invoice + billing info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                {/* Current Invoice */}
                <div className="rounded-xl p-4 border border-slate-100" style={{ background: "#FAFBFF" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Current Invoice</span>
                    <Badge className="text-[11px]" style={{ background: "#FEF3C7", color: "#92400E" }}>Pending</Badge>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 mb-0.5">${financial.currentInvoice.amount.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{financial.currentInvoice.number}</p>
                  <p className="text-xs text-slate-500 mt-2">Due {financial.currentInvoice.dueDate}</p>
                  <Button size="sm" className="mt-3 w-full rounded-xl text-xs gap-1.5 h-8" style={{ background: PURPLE }}>
                    <Download className="w-3.5 h-3.5" /> Download Invoice
                  </Button>
                </div>

                {/* Billing Summary */}
                <div className="rounded-xl p-4 border border-slate-100 space-y-0.5" style={{ background: "#FAFBFF" }}>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Billing Summary</p>
                  <StatRow label="Next Billing Date" value={financial.nextBilling} />
                  <StatRow label="Monthly Rate" value={`$${financial.monthlyCost.toLocaleString()}`} />
                  <StatRow label="Security Deposit" value={`$${financial.deposit.toLocaleString()}`} />
                </div>
              </div>

              {/* Invoice history table */}
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Invoice History</p>
                <div className="rounded-xl overflow-hidden border border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">Date</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">Period</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">Amount</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">Paid</th>
                        <th className="px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {financial.history.map((inv, i) => (
                        <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2.5 text-slate-700">{inv.date}</td>
                          <td className="px-3 py-2.5 text-slate-700">{inv.period}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800">${inv.amount.toLocaleString()}</td>
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                              style={{ background: "#D1FAE5", color: "#065F46" }}>
                              {inv.paid}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button className="text-slate-400 hover:text-purple-600 transition-colors">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4 — Documents */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* VA Documents */}
            <Card className="border-slate-200 shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-purple-500" /> VA Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {["Resume", "Profile", "Skills Assessment", "Certifications", "Employment Contract"].map((doc) => (
                    <div key={doc} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700">{doc}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Company Documents */}
            <Card className="border-slate-200 shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-blue-500" /> Company Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {["Master Service Agreement", "Onboarding Documents", "SOPs", "Training Materials", "Holiday Calendar", "Meeting Notes"].map((doc) => (
                    <div key={doc} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700">{doc}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section 5 — Communication */}
          <Card className="border-slate-200 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <SectionHeader title="Your OnSpot Contacts" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contacts.map((c) => (
                  <div key={c.name + c.role}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors bg-white">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarFallback className="text-white text-sm font-semibold"
                        style={{ background: c.color }}>
                        {c.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.role}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-purple-600 transition-colors">
                        <Video className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-blue-600 transition-colors">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-red-500 transition-colors">
                        <AlertCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section 6 — Requests */}
          <Card className="border-slate-200 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <SectionHeader title="Quick Requests" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Request Additional VA", icon: UserPlus, color: PURPLE },
                  { label: "Replace VA", icon: Shuffle, color: "#3B82F6" },
                  { label: "Change Schedule", icon: Calendar, color: "#10B981" },
                  { label: "Request Overtime", icon: Timer, color: "#F59E0B" },
                  { label: "Submit Feedback", icon: ThumbsUp, color: "#EC4899" },
                  { label: "Approve PTO", icon: CheckSquare, color: "#8B5CF6" },
                ].map(({ label, icon: Icon, color }) => (
                  <button key={label}
                    onClick={() => setActiveRequest(label)}
                    className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all bg-white text-center group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: color + "15" }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <span className="text-xs font-medium text-slate-700 leading-tight">{label}</span>
                  </button>
                ))}
              </div>
              {activeRequest && (
                <div className="mt-4 p-3 rounded-xl border border-purple-100 bg-purple-50 text-sm text-purple-800 flex items-center justify-between">
                  <span>Request submitted: <strong>{activeRequest}</strong></span>
                  <button onClick={() => setActiveRequest(null)} className="text-purple-500 hover:text-purple-700 text-xs">Dismiss</button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charts row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Hours chart */}
            <Card className="border-slate-200 shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-800">Weekly Hours Worked</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={hoursChart} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                    <Bar dataKey="hours" fill={PURPLE} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance chart */}
            <Card className="border-slate-200 shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-800">Performance Score</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={performanceChart}>
                    <defs>
                      <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PURPLE} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={PURPLE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[80, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                    <Area type="monotone" dataKey="score" stroke={PURPLE} strokeWidth={2} fill="url(#perfGrad)" dot={{ r: 3, fill: PURPLE }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Billing trend */}
            <Card className="border-slate-200 shadow-sm rounded-2xl sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-800">Monthly Billing Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={billingChart} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                      formatter={(v: number) => [`$${v.toLocaleString()}`, "Amount"]} />
                    <Bar dataKey="amount" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ══ RIGHT SIDEBAR (1/3) ══════════════════════════════════════════ */}
        <div className="space-y-5">

          {/* Vanessa AI */}
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3" style={{ background: "linear-gradient(135deg, #F5F3FF 0%, #EEF2FF 100%)" }}>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: PURPLE }}>
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-slate-800">Vanessa AI Assistant</span>
                <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "#D1FAE5", color: "#065F46" }}>Online</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <VanessaChat />
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-slate-200 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <SectionHeader title="Notifications"
                action={
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: "#EDE9FE", color: PURPLE }}>
                    {unreadCount} new
                  </span>
                }
              />
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {notifications.map((n) => {
                  const iconColor = n.type === "success" ? "#10B981" : n.type === "warning" ? "#F59E0B" : "#3B82F6";
                  return (
                    <div key={n.id}
                      className={`flex gap-3 p-2.5 rounded-xl transition-colors ${n.read ? "opacity-60" : ""}`}
                      style={{ background: n.read ? "transparent" : "#FAFBFF" }}>
                      <n.icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: iconColor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 leading-snug">{n.msg}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{n.time}</p>
                      </div>
                      {!n.read && <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: PURPLE }} />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* KPI summary cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Hours This Month", value: "89h", change: "+4h", up: true, icon: Clock },
              { label: "Attendance Rate", value: "96%", change: "+2%", up: true, icon: CheckCircle },
              { label: "PTO Balance", value: "8 days", change: "", up: null, icon: Palmtree },
              { label: "Open Invoices", value: "1", change: "Pending", up: null, icon: FileText },
            ].map(({ label, value, change, up, icon: Icon }) => (
              <Card key={label} className="border-slate-200 shadow-sm rounded-2xl">
                <CardContent className="p-4">
                  <Icon className="w-4 h-4 text-slate-400 mb-2" />
                  <p className="text-lg font-bold text-slate-900 leading-tight">{value}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
                  {change && (
                    <p className="text-[11px] mt-1 flex items-center gap-0.5"
                      style={{ color: up === true ? "#10B981" : up === false ? "#EF4444" : "#94A3B8" }}>
                      {up === true && <ArrowUp className="w-2.5 h-2.5" />}
                      {up === false && <ArrowDown className="w-2.5 h-2.5" />}
                      {change}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
