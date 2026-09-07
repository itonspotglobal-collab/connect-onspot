/**
 * NotificationBell — bell icon with persisted offer and job-application notifications.
 *
 * Talent users (talent-portal JWT) see "offer_received" notifications that link
 * to /my-applications.  The bell uses GET /api/talent/notifications so that the
 * server resolves candidateId → linked users.id, ensuring notifications are
 * fetched for the correct account.
 *
 * Client/admin users see offer responses and new job applications. These sessions use the main-JWT-authenticated
 * GET /api/users/:userId/notifications endpoint.
 */
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, PackageOpen, CheckCircle, XCircle, Clock, FileText, ClipboardList, Loader2, MessageSquare, CalendarClock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { loadTalentAuth } from "@/components/TalentLoginModal";
import { ClientNotificationUpdateDialog } from "@/components/ClientNotificationUpdateDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useUnreadNotificationsCount,
} from "@/hooks/useUnreadNotificationsCount";
import {
  applicationsFooterRouteForRole,
  clientNotificationModalKind,
  notificationTypesForRole,
  recentTalentInterviewProposalToasts,
  type ClientNotificationModalKind,
  notificationRouteForRole,
} from "@/lib/notificationRouting";

// ── Types ──────────────────────────────────────────────────────────────────────

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedId: string | null;
  relatedType: string | null;
  isRead: boolean;
  createdAt: string;
}

// ── Auth helpers ───────────────────────────────────────────────────────────────

function getBearerToken(): string | null {
  const jwtToken = localStorage.getItem("onspot_jwt_token");
  if (jwtToken) return jwtToken;
  try {
    const raw = localStorage.getItem("talent_profile_token");
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string };
      return parsed.token || null;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Per-type config ────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; label: string; route: string }
> = {
  offer_received: {
    icon: PackageOpen,
    color: "#D97706",   // amber-600
    bg: "#FEF3C7",      // amber-100
    label: "New Offer",
    route: "/my-applications",
  },
  job_invitation: {
    icon: FileText,
    color: "#4D55C7",
    bg: "#EEF2FF",
    label: "Invitation to Apply",
    route: "/my-applications",
  },
  offer_accepted: {
    icon: CheckCircle,
    color: "#059669",   // emerald-600
    bg: "#D1FAE5",      // emerald-100
    label: "Offer Accepted",
    route: "/hire-talent",
  },
  offer_declined: {
    icon: XCircle,
    color: "#64748B",   // slate-500
    bg: "#F1F5F9",      // slate-100
    label: "Offer Declined",
    route: "/hire-talent",
  },
  offer_expired: {
    icon: Clock,
    color: "#BE123C",   // rose-700
    bg: "#FFE4E6",      // rose-100
    label: "Offer Expired",
    route: "/hire-talent",
  },
  job_approved: {
    icon: CheckCircle,
    color: "#059669",
    bg: "#D1FAE5",
    label: "Job Approved",
    route: "/client-profile",
  },
  job_pending: {
    icon: Clock,
    color: "#B45309",
    bg: "#FEF3C7",
    label: "Job Back in Review",
    route: "/client-profile",
  },
  job_rejected: {
    icon: XCircle,
    color: "#DC2626",
    bg: "#FEE2E2",
    label: "Job Rejected",
    route: "/client-profile",
  },
  job_application_received: {
    icon: FileText,
    color: "#2563EB",
    bg: "#DBEAFE",
    label: "New Application",
    route: "/client-profile",
  },
  talent_invitation_accepted: {
    icon: CheckCircle,
    color: "#059669",
    bg: "#D1FAE5",
    label: "Invitation Accepted",
    route: "/client-profile",
  },
  interview_reschedule_proposed: {
    icon: CalendarClock,
    color: "#D97706",
    bg: "#FEF3C7",
    label: "New Interview Time",
    route: "/client/interviews",
  },
  interview_rescheduled: {
    icon: CalendarClock,
    color: "#D97706",
    bg: "#FEF3C7",
    label: "New Interview Time",
    route: "/my-applications",
  },
  interview_confirmed: {
    icon: CheckCircle,
    color: "#059669",
    bg: "#D1FAE5",
    label: "Interview Confirmed",
    route: "/my-applications",
  },
  job_application_status_changed: {
    icon: ClipboardList,
    color: "#7C3AED",
    bg: "#EDE9FE",
    label: "Application Update",
    route: "/my-applications",
  },
  client_application_status_changed: {
    icon: ClipboardList,
    color: "#2563EB",
    bg: "#DBEAFE",
    label: "Client Application Update",
    route: "/admin/job-applications",
  },
  talent_hired: {
    icon: CheckCircle,
    color: "#059669",
    bg: "#D1FAE5",
    label: "Talent Hired",
    route: "/client-profile",
  },
  new_message: {
    icon: MessageSquare,
    color: "#4D55C7",
    bg: "#EEF2FF",
    label: "New Message",
    route: "/messages",
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const talentAuth = loadTalentAuth();

  // Talent-portal sessions are identified by talentAuth (candidate JWT).
  // Main-JWT sessions (client/admin/talent) are identified by user.
  const isTalentPortal = !!talentAuth;
  const isTalent = isTalentPortal || user?.role === "talent";
  const relevantTypes = notificationTypesForRole(isTalent);

  // Only show bell when some auth session is active.
  const isAuthenticated = isTalentPortal || !!user;

  const unreadCount = useUnreadNotificationsCount();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notificationModal, setNotificationModal] = useState<{
    kind: ClientNotificationModalKind;
    notificationId: string;
  } | null>(null);
  const [hiredPopup, setHiredPopup] = useState<NotificationRow | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isTalent || !isAuthenticated || hiredPopup) return;
    let cancelled = false;
    const claimHiredPopup = async () => {
      const token = getBearerToken();
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const url = isTalentPortal
        ? "/api/talent/notifications/hired-popup/claim"
        : "/api/notifications/hired-popup/claim";
      try {
        const response = await fetch(url, { method: "POST", headers });
        const notification: NotificationRow | null = response.ok ? await response.json() : null;
        if (!cancelled && notification) setHiredPopup(notification);
      } catch {
        // The persistent bell notification remains available. Popup failures
        // must never affect authentication, navigation, or the Hired state.
      }
    };

    void claimHiredPopup();
    const intervalId = window.setInterval(claimHiredPopup, 15_000);
    window.addEventListener("focus", claimHiredPopup);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", claimHiredPopup);
    };
  }, [hiredPopup, isAuthenticated, isTalent, isTalentPortal, user?.id]);

  // Poll only the persisted Talent notification feed for new Client interview
  // proposals. Session storage prevents the same alert from firing on refresh.
  useEffect(() => {
    if (!isTalent || !isAuthenticated) return;

    let cancelled = false;
    const seenStorageKey = "onspot_talent_interview_proposal_toasts";

    const pollForInterviewProposal = async () => {
      const token = getBearerToken();
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const url = isTalentPortal
        ? "/api/talent/notifications?unread_only=true"
        : user?.id
          ? `/api/users/${user.id}/notifications?unread_only=true`
          : null;
      if (!url) return;

      try {
        const response = await fetch(url, { headers });
        if (!response.ok || cancelled) return;
        const data = await response.json() as NotificationRow[];
        const storedIds = JSON.parse(sessionStorage.getItem(seenStorageKey) ?? "[]");
        const seenIds = new Set<string>(Array.isArray(storedIds) ? storedIds : []);
        const candidates = recentTalentInterviewProposalToasts(data, seenIds);
        if (candidates.length === 0 || cancelled) return;

        for (const candidate of candidates) seenIds.add(candidate.id);
        sessionStorage.setItem(
          seenStorageKey,
          JSON.stringify(Array.from(seenIds).slice(-100)),
        );
        await qc.invalidateQueries({ queryKey: ["unread-notifications"] });

        for (const _candidate of candidates) {
          toast({
            title: "New interview time proposed",
            description: "The Client has asked you to review a new proposed time.",
          });
        }
      } catch {
        // The persisted bell notification remains the source of truth. A
        // transient poll failure must not interrupt the active Talent session.
      }
    };

    void pollForInterviewProposal();
    const intervalId = window.setInterval(pollForInterviewProposal, 15_000);
    window.addEventListener("focus", pollForInterviewProposal);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", pollForInterviewProposal);
    };
  }, [isAuthenticated, isTalent, isTalentPortal, qc, toast, user?.id]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Fetch notifications when panel opens.
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    setLoading(true);
    const token = getBearerToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // Talent-portal sessions use the talent-specific endpoint which resolves
    // candidateId → linked users.id server-side.
    // Main-JWT sessions (client/admin) use the user-id path endpoint.
    const url = isTalentPortal
      ? "/api/talent/notifications"
      : user?.id
        ? `/api/users/${user.id}/notifications`
        : null;

    if (!url) {
      setLoading(false);
      return;
    }

    fetch(url, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NotificationRow[]) => {
        const filtered = data.filter((n) => relevantTypes.includes(n.type));
        // Most-recent first, cap at 20.
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(filtered.slice(0, 20));
      })
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAuthenticated, isTalentPortal, user?.id]);

  if (!isAuthenticated) return null;

  async function handleClickNotification(n: NotificationRow) {
    setOpen(false);

    // Mark as read before opening details or navigating.
    if (!n.isRead) {
      const token = getBearerToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Talent-portal sessions use the talent-authenticated mark-read endpoint.
      // Main-JWT sessions use the standard endpoint (now auth-gated).
      const markReadUrl = isTalentPortal
        ? `/api/talent/notifications/${n.id}/read`
        : `/api/notifications/${n.id}/read`;

      try {
        const response = await fetch(markReadUrl, { method: "PATCH", headers });
        if (!response.ok) {
          throw new Error(`Unable to mark notification read (${response.status})`);
        }
        await qc.invalidateQueries({ queryKey: ["unread-notifications"] });
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
        );
      } catch {
        toast({
          title: "Could not open notification",
          description: "Please try again.",
          variant: "destructive",
        });
        return;
      }
    }

    const modalKind = clientNotificationModalKind(
      n.type,
      user?.role,
      n.relatedType,
      n.relatedId,
    );
    if (modalKind) {
      setNotificationModal({ kind: modalKind, notificationId: n.id });
      return;
    }

    const cfg = TYPE_CONFIG[n.type];
    if (n.type === "new_message" && n.relatedId) {
      navigate(`/messages/${encodeURIComponent(n.relatedId)}`);
    } else if (cfg) {
      const route = notificationRouteForRole(n.type, user?.role, cfg.route);
      if (route) navigate(route);
    }
  }

  return (
    <div className="relative hidden md:block">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        data-testid="notification-bell"
        className="relative flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <Bell className="w-5 h-5 text-white/80" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 flex items-center justify-center rounded-full bg-red-500 text-white font-bold"
            style={{ minWidth: 16, height: 16, fontSize: 10, padding: "0 4px", lineHeight: 1 }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          style={{ zIndex: 9999, top: "100%" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                {unreadCount} new
              </span>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-50">
            {loading && (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No notifications yet</p>
              </div>
            )}

            {!loading &&
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.offer_received;
                const Icon = cfg.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    data-testid={`notification-${n.id}`}
                    className={[
                      "w-full flex gap-3 px-4 py-3 text-left transition-colors",
                      n.isRead
                        ? "hover:bg-slate-50"
                        : "bg-blue-50/40 hover:bg-blue-50/70",
                    ].join(" ")}
                  >
                    {/* Icon bubble */}
                    <div
                      className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
                      style={{ background: cfg.bg }}
                    >
                      <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-800 leading-snug truncate">
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                );
              })}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100">
              <button
                onClick={() => {
                  setOpen(false);
                  navigate(applicationsFooterRouteForRole(user?.role, isTalent));
                }}
                className="w-full py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                {isTalent ? "View my applications →" : "View applications →"}
              </button>
            </div>
          )}
        </div>
      )}
      <ClientNotificationUpdateDialog
        open={notificationModal !== null}
        kind={notificationModal?.kind ?? "invitation_acceptance"}
        notificationId={notificationModal?.notificationId ?? null}
        onClose={() => setNotificationModal(null)}
      />
      <Dialog open={hiredPopup !== null} onOpenChange={(nextOpen) => {
        if (!nextOpen) setHiredPopup(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Congratulations — you're hired!</DialogTitle>
            <DialogDescription>
              {hiredPopup?.message}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            You can review your application, contract, and next steps in OnSpot.
          </p>
          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => setHiredPopup(null)}>
              Close
            </Button>
            <Button onClick={() => {
              setHiredPopup(null);
              navigate("/my-applications");
            }}>
              View Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
