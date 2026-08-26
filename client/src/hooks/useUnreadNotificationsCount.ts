import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { loadTalentAuth } from "@/components/TalentLoginModal";

interface NotificationRow {
  id: string;
  type: string;
  isRead: boolean;
}

export const TALENT_NOTIFICATION_TYPES = [
  "offer_received",
  "job_application_status_changed",
  "new_message",
] as const;

export const CLIENT_NOTIFICATION_TYPES = [
  "offer_accepted",
  "offer_declined",
  "offer_expired",
  "job_approved",
  "job_application_received",
  "client_application_status_changed",
  "new_message",
] as const;

export function notificationTypesForRole(isTalent: boolean): readonly string[] {
  return isTalent ? TALENT_NOTIFICATION_TYPES : CLIENT_NOTIFICATION_TYPES;
}

function getBearerToken(): string | null {
  const jwtToken = localStorage.getItem("onspot_jwt_token");
  if (jwtToken) return jwtToken;
  try {
    const raw = localStorage.getItem("talent_profile_token");
    if (raw) return (JSON.parse(raw) as { token?: string }).token || null;
  } catch {
    // A corrupt local talent session should behave as an unauthenticated request.
  }
  return null;
}

async function fetchUnreadNotificationsCount(
  isTalentPortal: boolean,
  userId: string | null,
  role: string,
): Promise<number> {
  const token = getBearerToken();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const url = isTalentPortal
    ? "/api/talent/notifications?unread_only=true"
    : userId
      ? `/api/users/${userId}/notifications?unread_only=true`
      : null;

  if (!url) return 0;
  const response = await fetch(url, { headers });
  if (!response.ok) return 0;

  const notifications: NotificationRow[] = await response.json();
  const relevantTypes = notificationTypesForRole(isTalentPortal || role === "talent");
  return notifications.filter((notification) => relevantTypes.includes(notification.type)).length;
}

/**
 * Counts persisted, unread notification events relevant to the authenticated
 * Talent, Client, or Admin session. Talent Portal sessions keep using their
 * candidate-token endpoint so the server resolves the canonical users.id.
 */
export function useUnreadNotificationsCount(): number {
  const { user } = useAuth();
  const talentAuth = loadTalentAuth();
  const isTalentPortal = !!talentAuth;
  const userId = user?.id ?? null;
  const role = talentAuth ? "talent" : (user?.role ?? "");

  const { data: count = 0 } = useQuery<number>({
    queryKey: ["unread-notifications", isTalentPortal, userId, role],
    queryFn: () => fetchUnreadNotificationsCount(isTalentPortal, userId, role),
    enabled: isTalentPortal || !!userId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  return count;
}