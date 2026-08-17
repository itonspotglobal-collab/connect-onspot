import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { loadTalentAuth } from "@/components/TalentLoginModal";

interface NotificationRow {
  id: string;
  type: string;
  isRead: boolean;
  relatedId: string | null;
}

/** Replicates the getBearerToken() logic from queryClient.ts without importing it. */
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
 * Fetches the count of unread new_message notifications.
 *
 * Talent-portal sessions (talentAuth present): uses GET /api/talent/notifications
 * which resolves candidateId → linked users.id server-side, ensuring the correct
 * account's notifications are returned even though the candidate-token JWT carries
 * a candidateId rather than a users.id.
 *
 * Main-JWT sessions (client/admin/talent with a full user account): uses
 * GET /api/users/:userId/notifications, which now requires the bearer token and
 * verifies the caller owns the requested userId.
 */
async function fetchUnreadMessageCount(
  isTalentPortal: boolean,
  userId: string | null,
): Promise<number> {
  const token = getBearerToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  if (isTalentPortal) {
    // Talent-portal JWT: use the authenticated endpoint that resolves the
    // correct users.id server-side so no 403 is returned.
    const res = await fetch("/api/talent/notifications?unread_only=true", { headers });
    if (!res.ok) return 0;
    const data: NotificationRow[] = await res.json();
    return data.filter((n) => n.type === "new_message").length;
  }

  if (!userId) return 0;
  const res = await fetch(
    `/api/users/${userId}/notifications?unread_only=true`,
    { headers },
  );
  if (!res.ok) return 0;
  const data: NotificationRow[] = await res.json();
  return data.filter((n) => n.type === "new_message").length;
}

/**
 * Returns the count of unread new_message notifications for the currently
 * authenticated talent (covers both talent-portal JWT and main JWT paths).
 * Returns 0 for non-talent sessions.
 */
export function useUnreadMessagesCount(): number {
  const { user } = useAuth();
  const talentAuth = loadTalentAuth();

  // Talent-portal sessions use /api/talent/notifications (no userId needed).
  // Main-JWT talent sessions use the user's actual users.id.
  const isTalentPortal = !!talentAuth;
  const userId = user?.role === "talent" ? (user?.id ?? null) : null;

  const { data: count = 0 } = useQuery<number>({
    queryKey: ["unread-messages-count", isTalentPortal, userId],
    queryFn: () => fetchUnreadMessageCount(isTalentPortal, userId),
    enabled: isTalentPortal || !!userId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  return count;
}

/** Invalidates the unread-messages badge — call after the talent reads a thread. */
export function useInvalidateUnreadMessages(): () => void {
  const qc = useQueryClient();
  const { user } = useAuth();
  const talentAuth = loadTalentAuth();
  const isTalentPortal = !!talentAuth;
  const userId = user?.role === "talent" ? (user?.id ?? null) : null;
  return () =>
    qc.invalidateQueries({ queryKey: ["unread-messages-count", isTalentPortal, userId] });
}
