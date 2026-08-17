import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { loadTalentAuth } from "@/components/TalentLoginModal";

interface NotificationRow {
  id: string;
  type: string;
  isRead: boolean;
}

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

/**
 * Fetches unread offer-related notifications.
 *
 * Talent-portal sessions (talentAuth present): uses GET /api/talent/notifications
 * which resolves candidateId → linked users.id server-side, so notifications
 * are always fetched for the correct user account.
 *
 * Client/admin sessions: uses GET /api/users/:userId/notifications (main JWT).
 */
async function fetchUnreadOfferCount(
  isTalentPortal: boolean,
  userId: string | null,
  role: string,
): Promise<number> {
  const token = getBearerToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  if (isTalentPortal) {
    // Talent-portal JWT: use the authenticated endpoint that resolves the
    // correct users.id server-side from the candidate record.
    const res = await fetch("/api/talent/notifications?unread_only=true", { headers });
    if (!res.ok) return 0;
    const data: NotificationRow[] = await res.json();
    return data.filter((n) => n.type === "offer_received").length;
  }

  // Main JWT (client / admin / talent with a full user account).
  if (!userId) return 0;
  const res = await fetch(
    `/api/users/${userId}/notifications?unread_only=true`,
    { headers },
  );
  if (!res.ok) return 0;
  const data: NotificationRow[] = await res.json();
  if (role === "talent") {
    return data.filter((n) => n.type === "offer_received").length;
  }
  return data.filter(
    (n) => n.type === "offer_accepted" || n.type === "offer_declined",
  ).length;
}

/**
 * Returns the count of unread offer notifications for the currently
 * authenticated user.  Covers talent-portal JWT, talent main JWT, and
 * client/admin JWT paths.  Returns 0 when the user has no relevant unread
 * offer notifications.
 */
export function useUnreadOfferNotificationsCount(): number {
  const { user } = useAuth();
  const talentAuth = loadTalentAuth();

  // Talent-portal sessions use the /api/talent/notifications endpoint which
  // resolves the correct users.id server-side — no client-side userId needed.
  const isTalentPortal = !!talentAuth;
  const userId = user?.id ?? null;
  const role = talentAuth ? "talent" : (user?.role ?? "");

  const { data: count = 0 } = useQuery<number>({
    queryKey: ["unread-offer-notifications", isTalentPortal, userId, role],
    queryFn: () => fetchUnreadOfferCount(isTalentPortal, userId, role),
    enabled: isTalentPortal || !!userId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  return count;
}
