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
 * Fetches unread offer-related notifications for the given user.
 * - Talent users: counts 'offer_received' notifications (a client sent them an offer).
 * - Client/admin users: counts 'offer_accepted' and 'offer_declined' notifications
 *   (a talent responded to their offer).
 */
async function fetchUnreadOfferCount(userId: string, role: string): Promise<number> {
  const token = getBearerToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
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
 * Returns the count of unread offer notifications for the currently authenticated user.
 * Covers talent-portal JWT, talent main JWT, and client/admin JWT paths.
 * Returns 0 when the user has no relevant unread offer notifications.
 */
export function useUnreadOfferNotificationsCount(): number {
  const { user } = useAuth();
  const talentAuth = loadTalentAuth();

  const userId =
    talentAuth?.candidateId ??
    (user?.id ?? null);

  const role =
    talentAuth ? "talent" : (user?.role ?? "");

  const { data: count = 0 } = useQuery<number>({
    queryKey: ["unread-offer-notifications", userId, role],
    queryFn: () => fetchUnreadOfferCount(userId!, role),
    enabled: !!userId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  return count;
}
