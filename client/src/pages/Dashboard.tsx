import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Mail, Globe, CalendarDays, Clock, ChevronRight, Download,
  FileText, Folder, MessageSquare, CalendarCheck, Bell,
  CheckCircle, AlertCircle, Info, UserPlus, Shuffle,
  AlarmClock, Star, ThumbsUp, Send, Bot, Loader2,
  CalendarIcon, Eye,
} from "lucide-react";
import avatarImage from "@assets/generated_images/Professional_talent_avatar_71613d75.png";

// ── Design tokens ──────────────────────────────────────────────────────────
const BLUE = "#2563EB";
const GREEN = "#16A34A";
const ORANGE = "#EA580C";
const RED = "#DC2626";

// ── Mock data (replace with API calls) ────────────────────────────────────
const vaProfile = {
  name: "Jane Smith",
  position: "Virtual Executive Assistant",
  status: "online" as const,
  email: "jane.smith@onspotstaff.com",
  timezone: "GMT+8 (PH Time)",
  workingDays: "Monday – Friday",
  schedule: "9:00 AM – 6:00 PM (PH Time)",
};

const todayOverview = {
  timeIn: "8:58 AM",
  timeOut: "—",
  hoursToday: "1h 44m",
  hoursWeek: "23h 15m",
  hoursMonth: "98h 40m",
};

const attendanceSummary = [
  { label: "Attendance This Month", value: "98%", color: GREEN },
  { label: "Late", value: "2%", color: ORANGE },
  { label: "Absent", value: "0%", color: GREEN },
  { label: "Leaves", value: "1 Day", color: BLUE },
  { label: "Overtime", value: "3h 20m", color: BLUE },
];

const attendanceRows = [
  { date: "Fri, Jul 18 (Today)", timeIn: "8:58 AM", timeOut: "—", breaks: "0h 30m", pto: "—", overtime: "—", status: "inprogress" },
  { date: "Thu, Jul 17", timeIn: "8:54 AM", timeOut: "6:02 PM", breaks: "0h 30m", pto: "—", overtime: "0h 02m", status: "completed" },
  { date: "Wed, Jul 16", timeIn: "8:57 AM", timeOut: "6:00 PM", breaks: "0h 30m", pto: "—", overtime: "—", status: "completed" },
  { date: "Tue, Jul 15", timeIn: "9:01 AM", timeOut: "6:01 PM", breaks: "0h 30m", pto: "—", overtime: "0h 01m", status: "completed" },
  { date: "Mon, Jul 14", timeIn: "8:59 AM", timeOut: "6:00 PM", breaks: "0h 30m", pto: "—", overtime: "—", status: "completed" },
  { date: "Sun, Jul 13", timeIn: "—", timeOut: "—", breaks: "—", pto: "—", overtime: "—", status: "holiday" },
  { date: "Sat, Jul 12", timeIn: "—", timeOut: "—", breaks: "—", pto: "—", overtime: "—", status: "holiday" },
];

const currentInvoice = {
  number: "INV-2025-07-001",
  status: "paid" as "paid" | "pending" | "overdue",
  amount: 1850,
  dueDate: "Jul 20, 2025",
  nextBilling: "Aug 20, 2025",
  monthlyCost: 1850,
  deposit: 500,
};

const invoiceHistory = [
  { date: "Jul 1, 2025", period: "Jul 1 – Jul 31, 2025", amount: 1850, paid: "Jul 5, 2025" },
  { date: "Jun 1, 2025", period: "Jun 1 – Jun 30, 2025", amount: 1850, paid: "Jun 5, 2025" },
  { date: "May 1, 2025", period: "May 1 – May 31, 2025", amount: 1850, paid: "May 5, 2025" },
  { date: "Apr 1, 2025", period: "Apr 1 – Apr 30, 2025", amount: 1850, paid: "Apr 5, 2025" },
  { date: "Mar 1, 2025", period: "Mar 1 – Mar 31, 2025", amount: 1850, paid: "Mar 5, 2025" },
  { date: "Feb 1, 2025", period: "Feb 1 – Feb 28, 2025", amount: 1850, paid: "Feb 5, 2025" },
];

const vaDocs = [
  { name: "Resume", date: "Jun 1, 2025", color: RED },
  { name: "Profile", date: "Jun 1, 2025", color: "#2563EB" },
  { name: "Skills", date: "Jun 1, 2025", color: "#2563EB" },
  { name: "Certifications", date: "Jun 1, 2025", color: ORANGE },
  { name: "Employment Date", date: "Jun 1, 2025", color: GREEN },
];

const companyDocs = [
  { name: "MSA", date: "May 1, 2025" },
  { name: "Onboarding Document", date: "May 1, 2025" },
  { name: "SOPs", date: "Jun 10, 2025" },
  { name: "Training Materials", date: "Jun 10, 2025" },
  { name: "Holiday Calendar", date: "Dec 1, 2024" },
  { name: "Payroll Calendar", date: "Dec 1, 2024" },
  { name: "Meeting Notes", date: "Jul 8, 2025" },
];

const contacts = [
  { name: "Odie Galang", role: "Delivery Manager", initials: "OG", color: "#2563EB" },
  { name: "Nur Laminero", role: "CEO", initials: "NL", color: "#7C3AED" },
  { name: "Odie Galang", role: "Billing", initials: "OG", color: "#059669" },
  { name: "Mark Anthony Apostol", role: "Recruitment & HR", initials: "MA", color: ORANGE },
];

const requestActions = [
  { label: "Request Additional VA", icon: UserPlus },
  { label: "Replace VA", icon: Shuffle },
  { label: "Change Schedule", icon: CalendarDays },
  { label: "Request Overtime", icon: AlarmClock },
  { label: "Submit Feedback", icon: ThumbsUp },
  { label: "Approve PTO", icon: CheckCircle },
];

const notifications = [
  { text: "Jane Smith clocked in at 8:58 AM", time: "Today, 8:58 AM", type: "success", read: false },
  { text: "Invoice INV-2025-07-001 generated", time: "Jul 1, 2025", type: "info", read: false },
  { text: "Invoice for July is due on Jul 20, 2025", time: "Jul 1, 2025", type: "warning", read: false },
  { text: "PTO approved for Jul 25, 2025", time: "Jun 28, 2025", type: "success", read: true },
  { text: "New document uploaded: SOP – Client Onboarding", time: "Jun 25, 2025", type: "info", read: true },
];

const vanessaPrompts = [
  "How many hours has my VA worked this week?",
  "Show me invoices from the last six months.",
  "When is my next billing date?",
  "How many days was my VA absent this year?",
];

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt$(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`; }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    online:     { label: "Online",      bg: "#DCFCE7", color: GREEN },
    inprogress: { label: "In Progress", bg: "#DBEAFE", color: BLUE },
    completed:  { label: "Completed",   bg: "#DCFCE7", color: GREEN },
    holiday:    { label: "Holiday",     bg: "#FEF3C7", color: ORANGE },
    onleave:    { label: "On Leave",    bg: "#FEE2E2", color: RED },
  };
  const s = map[status] ?? map.inprogress;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function InvoiceStatusBadge({ status }: { status: "paid" | "pending" | "overdue" }) {
  const map = {
    paid:    { label: "Paid",    bg: "#DCFCE7", color: GREEN },
    pending: { label: "Pending", bg: "#FEF3C7", color: ORANGE },
    overdue: { label: "Overdue", bg: "#FEE2E2", color: RED },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
      <h3 className="text-sm font-semibold text-slate-800">{children}</h3>
      {action}
    </div>
  );
}

// ── VA Overview Card ───────────────────────────────────────────────────────
function VAOverviewCard() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <SectionCard>
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
        {/* Left: Profile */}
        <div className="p-5 flex gap-4">
          <Avatar className="w-20 h-20 flex-shrink-0 ring-2 ring-slate-100">
            <AvatarImage src={avatarImage} alt={vaProfile.name} />
            <AvatarFallback className="bg-blue-600 text-white font-semibold text-lg">JS</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h2 className="text-lg font-bold text-slate-900">{vaProfile.name}</h2>
              <StatusBadge status="online" />
            </div>
            <p className="text-sm text-slate-500 mb-3">{vaProfile.position}</p>
            <div className="space-y-1.5">
              {[
                { icon: Mail,        label: vaProfile.email },
                { icon: Globe,       label: vaProfile.timezone },
                { icon: CalendarDays,label: vaProfile.workingDays },
                { icon: Clock,       label: vaProfile.schedule },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-xs text-slate-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Today's Overview */}
        <div className="p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Today's Overview</p>
          <div className="flex items-start gap-3 mb-4">
            <Clock className="w-5 h-5 text-slate-400 mt-1 flex-shrink-0" />
            <div>
              <p className="text-3xl font-bold text-slate-900 leading-none">{timeStr}</p>
              <p className="text-xs text-slate-500 mt-1">{dateStr}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              { label: "Time In",            value: todayOverview.timeIn,     hex: GREEN },
              { label: "Time Out",           value: todayOverview.timeOut,    hex: "" },
              { label: "Hours Worked Today", value: todayOverview.hoursToday, hex: GREEN },
              { label: "This Week's Hours",  value: todayOverview.hoursWeek,  hex: BLUE },
              { label: "This Month's Hours", value: todayOverview.hoursMonth, hex: BLUE },
            ].map(({ label, value, hex }) => (
              <div key={label}>
                <p className="text-[11px] text-slate-500">{label}</p>
                <p className="text-sm font-bold" style={{ color: hex || "#64748B" }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Attendance Dashboard ───────────────────────────────────────────────────
function AttendanceDashboard() {
  return (
    <SectionCard className="flex flex-col">
      <SectionTitle action={
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 rounded">
          <CalendarIcon className="w-3.5 h-3.5" /> View Calendar
        </Button>
      }>
        Attendance Dashboard
      </SectionTitle>

      {/* Summary */}
      <div className="grid grid-cols-5 divide-x divide-slate-100 border-b border-slate-100">
        {attendanceSummary.map(({ label, value, color }) => (
          <div key={label} className="px-3 py-3 text-center">
            <p className="text-lg font-bold leading-tight" style={{ color }}>{value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {["Date", "Daily Time In", "Daily Time Out", "Breaks", "PTO / Leave", "Overtime", "Status"].map(h => (
                <th key={h} className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attendanceRows.map((row, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap font-medium">{row.date}</td>
                <td className="px-3 py-2 font-medium" style={{ color: row.timeIn !== "—" ? GREEN : undefined }}>
                  {row.timeIn}
                </td>
                <td className="px-3 py-2" style={{ color: row.timeOut !== "—" ? RED : undefined }}>
                  {row.timeOut}
                </td>
                <td className="px-3 py-2 text-slate-500">{row.breaks}</td>
                <td className="px-3 py-2 text-slate-500">{row.pto}</td>
                <td className="px-3 py-2 text-slate-500">{row.overtime}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ── Financial Overview ─────────────────────────────────────────────────────
function FinancialOverview() {
  return (
    <SectionCard className="flex flex-col">
      <SectionTitle>Financial Overview</SectionTitle>

      {/* Current invoice */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">Current Invoice</span>
          <InvoiceStatusBadge status={currentInvoice.status} />
        </div>
        <p className="text-xs text-slate-500 mb-1">{currentInvoice.number}</p>
        <p className="text-2xl font-bold text-slate-900">{fmt$(currentInvoice.amount)}</p>
        <p className="text-xs text-slate-500 mt-0.5">Due Date: {currentInvoice.dueDate}</p>

        <div className="grid grid-cols-3 gap-3 mt-3 mb-3">
          {[
            { label: "Next Billing Date", value: currentInvoice.nextBilling },
            { label: "Running Monthly Cost", value: fmt$(currentInvoice.monthlyCost) },
            { label: "Security Deposit", value: fmt$(currentInvoice.deposit) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-slate-400 leading-tight">{label}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs rounded gap-1.5" style={{ color: BLUE, borderColor: "#BFDBFE" }}>
            <Eye className="w-3.5 h-3.5" /> View Invoice
          </Button>
          <Button size="sm" variant="outline" className="h-8 w-8 rounded p-0">
            <Download className="w-3.5 h-3.5 text-slate-500" />
          </Button>
        </div>
      </div>

      {/* Invoice history */}
      <div className="px-4 pt-2 pb-1">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Invoice History</p>
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-y border-slate-100">
              {["Invoice Date", "Period", "Amount", "Date Paid", ""].map((h, i) => (
                <th key={i} className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoiceHistory.map((inv, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{inv.date}</td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{inv.period}</td>
                <td className="px-3 py-2 font-semibold text-slate-800">{fmt$(inv.amount)}</td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{inv.paid}</td>
                <td className="px-3 py-2 text-right">
                  <button className="text-slate-400 hover:text-blue-600 transition-colors p-0.5 rounded">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ── Documents Card ─────────────────────────────────────────────────────────
function DocumentsCard() {
  return (
    <SectionCard>
      <SectionTitle>Documents</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {/* VA Docs */}
        <div className="p-4">
          <p className="text-xs font-semibold text-slate-600 mb-3">VA Documents</p>
          <div className="space-y-2">
            {vaDocs.map((d) => (
              <div key={d.name} className="flex items-center gap-2.5 py-1">
                <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: d.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700">{d.name}</p>
                  <p className="text-[10px] text-slate-400">Uploaded {d.date}</p>
                </div>
                <div className="flex gap-1">
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
          <button className="w-full mt-3 py-2 text-xs font-medium border border-slate-200 rounded text-slate-600 hover:bg-slate-50 transition-colors">
            View All VA Documents
          </button>
        </div>

        {/* Company Docs */}
        <div className="p-4">
          <p className="text-xs font-semibold text-slate-600 mb-3">Company Documents</p>
          <div className="space-y-2">
            {companyDocs.map((d) => (
              <div key={d.name} className="flex items-center gap-2.5 py-1">
                <Folder className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700">{d.name}</p>
                  <p className="text-[10px] text-slate-400">Updated {d.date}</p>
                </div>
                <div className="flex gap-1">
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
          <button className="w-full mt-3 py-2 text-xs font-medium border border-slate-200 rounded text-slate-600 hover:bg-slate-50 transition-colors">
            View All Company Documents
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Communication Panel ────────────────────────────────────────────────────
function CommunicationPanel() {
  return (
    <SectionCard>
      <SectionTitle>Communication</SectionTitle>
      <div className="divide-y divide-slate-50">
        {contacts.map((c) => (
          <div key={c.name + c.role} className="flex items-center gap-3 px-4 py-2.5">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="text-white text-xs font-semibold" style={{ background: c.color }}>
                {c.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{c.name}</p>
              <p className="text-[11px] text-slate-500">{c.role}</p>
            </div>
            <div className="flex gap-1.5">
              <button className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-blue-600 transition-colors">
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-green-600 transition-colors">
                <CalendarCheck className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 border-t border-slate-100">
        <button className="w-full py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
          View All Contacts
        </button>
      </div>
    </SectionCard>
  );
}

// ── Requests Panel ─────────────────────────────────────────────────────────
function RequestsPanel() {
  const [submitted, setSubmitted] = useState<string | null>(null);
  return (
    <SectionCard>
      <SectionTitle>Requests</SectionTitle>
      <div className="divide-y divide-slate-50">
        {requestActions.map(({ label, icon: Icon }) => (
          <button key={label} onClick={() => setSubmitted(label)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left">
            <div className="w-7 h-7 rounded flex items-center justify-center bg-blue-50 flex-shrink-0">
              <Icon className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <span className="flex-1 text-xs font-medium text-slate-700">{label}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          </button>
        ))}
      </div>
      {submitted && (
        <div className="mx-4 mb-2 mt-1 px-3 py-2 rounded bg-blue-50 border border-blue-100 text-xs text-blue-700 flex items-center justify-between">
          <span>Submitted: <strong>{submitted}</strong></span>
          <button onClick={() => setSubmitted(null)} className="text-blue-400 hover:text-blue-600">✕</button>
        </div>
      )}
      <div className="px-4 py-2.5 border-t border-slate-100">
        <button className="w-full py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
          View All Requests
        </button>
      </div>
    </SectionCard>
  );
}

// ── Notifications Panel ────────────────────────────────────────────────────
function NotificationsPanel() {
  const typeIcon: Record<string, { icon: typeof CheckCircle; color: string }> = {
    success: { icon: CheckCircle, color: GREEN },
    info:    { icon: Info,         color: BLUE },
    warning: { icon: AlertCircle,  color: ORANGE },
  };
  return (
    <SectionCard>
      <SectionTitle>
        <span className="flex items-center gap-2">
          Notifications
          <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {notifications.filter(n => !n.read).length}
          </span>
        </span>
      </SectionTitle>
      <div className="divide-y divide-slate-50">
        {notifications.map((n, i) => {
          const { icon: Icon, color } = typeIcon[n.type] ?? typeIcon.info;
          return (
            <div key={i}
              className={`flex gap-3 px-4 py-2.5 ${!n.read ? "bg-blue-50/40" : ""}`}>
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 leading-snug">{n.text}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{n.time}</p>
              </div>
              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
            </div>
          );
        })}
      </div>
      <div className="px-4 py-2.5 border-t border-slate-100">
        <button className="w-full py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
          View All Notifications
        </button>
      </div>
    </SectionCard>
  );
}

// ── Vanessa AI Assistant ───────────────────────────────────────────────────
function VanessaAssistant() {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const mockReplies: Record<string, string> = {
    "how many hours has my va worked this week?":
      "Jane has worked 23h 15m this week (Mon–Thu). She's on track for a full week.",
    "show me invoices from the last six months.":
      "Feb – Jul 2025: All invoices are $1,850/month. Total paid: $9,250. Current invoice is due Jul 20.",
    "when is my next billing date?":
      "Your next billing date is August 20, 2025. The invoice will be $1,850.00.",
    "how many days was my va absent this year?":
      "Jane has had 0 absences this year. She has 1 approved leave day and 3h 20m of overtime.",
  };

  function sendMessage(text?: string) {
    const msg = text ?? input.trim();
    if (!msg) return;
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      const reply = mockReplies[msg.toLowerCase()] ??
        "I'll look that up for you. For the most accurate answer, check the relevant section above or contact your Delivery Manager.";
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
      setLoading(false);
    }, 900);
  }

  return (
    <SectionCard>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: BLUE }}>
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">AI Assistant (Vanessa)</h3>
        <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">
          Online
        </span>
      </div>

      {/* History */}
      {messages.length > 0 && (
        <div className="px-4 py-3 space-y-2.5 border-b border-slate-100 max-h-40 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              {m.role === "assistant" && (
                <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5" style={{ background: BLUE }}>
                  <Bot className="w-3 h-3 text-white" />
                </div>
              )}
              <div className={`text-xs rounded-lg px-2.5 py-1.5 max-w-[85%] leading-relaxed ${
                m.role === "user" ? "text-white rounded-tr-sm" : "bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-sm"
              }`} style={m.role === "user" ? { background: BLUE } : {}}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: BLUE }}>
                <Bot className="w-3 h-3 text-white" />
              </div>
              <div className="bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggested prompts */}
      <div className="divide-y divide-slate-50">
        {vanessaPrompts.map((p) => (
          <button key={p} onClick={() => sendMessage(p)}
            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left">
            <span className="flex-1 text-xs text-slate-600">{p}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-100 flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Vanessa anything about your account..."
          className="text-xs h-8 rounded border-slate-200 bg-slate-50 flex-1"
          onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
        <Button size="icon" onClick={() => sendMessage()}
          className="h-8 w-8 rounded flex-shrink-0" style={{ background: BLUE }}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </SectionCard>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">Home Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Overview of your VA, attendance, financials and important updates
        </p>
      </div>

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        {/* ── Left main content ─────────────────────────────────── */}
        <div className="space-y-4 min-w-0">
          <VAOverviewCard />

          {/* Attendance + Financial side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AttendanceDashboard />
            <FinancialOverview />
          </div>

          <DocumentsCard />
        </div>

        {/* ── Right sidebar ─────────────────────────────────────── */}
        <div className="space-y-4">
          <CommunicationPanel />
          <RequestsPanel />
          <NotificationsPanel />
          <VanessaAssistant />
        </div>
      </div>
    </div>
  );
}
