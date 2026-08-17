/**
 * NotificationBell — bell icon with dropdown list for offer-related notifications.
 *
 * Talent users (talent-portal JWT) see "offer_received" notifications that link
 * to /my-applications.  The bell uses GET /api/talent/notifications so that the
 * server resolves candidateId → linked users.id, ensuring notifications are
 * fetched for the correct account.
 *
 * Client/admin users see "offer_accepted" and "offer_declined" notifications
 * that link to /hire-talent.  These sessions use the main-JWT-authenticated
 * GET /api/users/:userId/notifications endpoint.
 */
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, PackageOpen, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { loadTalentAuth } from "@/components/TalentLoginModal";
import { useUnreadOfferNotificationsCount } from "@/hooks/useUnreadOfferNotificationsCount";

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
};

const OFFER_TYPES_TALENT = ["offer_received"];
const OFFER_TYPES_CLIENT = ["offer_accepted", "offer_declined", "offer_expired"];

// ── Component ──────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const talentAuth = loadTalentAuth();

  // Talent-portal sessions are identified by talentAuth (candidate JWT).
  // Main-JWT sessions (client/admin/talent) are identified by user.
  const isTalentPortal = !!talentAuth;
  const isTalent = isTalentPortal || user?.role === "talent";
  const relevantTypes = isTalent ? OFFER_TYPES_TALENT : OFFER_TYPES_CLIENT;

  // Only show bell when some auth session is active.
  const isAuthenticated = isTalentPortal || !!user;

  const unreadCount = useUnreadOfferNotificationsCount();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

    // Mark as read (fire-and-forget; don't block navigation).
    if (!n.isRead) {
      const token = getBearerToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Talent-portal sessions use the talent-authenticated mark-read endpoint.
      // Main-JWT sessions use the standard endpoint (now auth-gated).
      const markReadUrl = isTalentPortal
        ? `/api/talent/notifications/${n.id}/read`
        : `/api/notifications/${n.id}/read`;

      fetch(markReadUrl, { method: "PATCH", headers })
        .then(() => {
          // Invalidate the badge count so it refreshes.
          qc.invalidateQueries({ queryKey: ["unread-offer-notifications"] });
          // Optimistically mark read in local state.
          setNotifications((prev) =>
            prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
          );
        })
        .catch(() => {/* ignore */});
    }

    const cfg = TYPE_CONFIG[n.type];
    if (cfg) navigate(cfg.route);
  }

  return (
    <div className="relative hidden md:block">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Offer notifications"
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
              {isTalent ? "Offer Notifications" : "Offer Updates"}
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
                <p className="text-xs text-slate-400">No offer notifications yet</p>
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
                  navigate(isTalent ? "/my-applications" : "/hire-talent");
                }}
                className="w-full py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                {isTalent ? "View all offers →" : "Go to hiring pipeline →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
