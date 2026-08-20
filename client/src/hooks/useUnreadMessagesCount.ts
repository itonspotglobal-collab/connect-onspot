import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { loadTalentAuth } from "@/components/TalentLoginModal";

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
 * Fetches the canonical persisted message unread count. The endpoint accepts
 * both main JWTs and candidate/talent JWTs and calculates unread state from
 * incoming messages' readBy arrays, not from notification rows.
 */
async function fetchUnreadMessageCount(
  isTalentPortal: boolean,
  userId: string | null,
): Promise<number> {
  const token = getBearerToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  if (!isTalentPortal && !userId) return 0;
  const res = await fetch("/api/me/message-threads", { headers });
  if (!res.ok) return 0;
  const data = await res.json() as { unreadMessageCount?: number };
  return Math.max(0, Number(data.unreadMessageCount ?? 0));
}

/**
 * Returns the persisted unread incoming-message count for the currently
 * authenticated user — covers talent-portal JWT, main-JWT talent, and
 * main-JWT client roles (clients receive messages too).
 * Returns 0 for unauthenticated or admin sessions.
 */
export function useUnreadMessagesCount(): number {
  const { user } = useAuth();
  const talentAuth = loadTalentAuth();

  // Talent-portal sessions use /api/talent/notifications (no userId needed).
  // Main-JWT talent AND client sessions use the user's actual users.id via
  // GET /api/users/:userId/notifications so that both roles see their badge.
  const isTalentPortal = !!talentAuth;
  const userId =
    user?.role === "talent" || user?.role === "client"
      ? (user?.id ?? null)
      : null;

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

/** Invalidates the unread-messages badge — call after any user reads a thread. */
export function useInvalidateUnreadMessages(): () => void {
  const qc = useQueryClient();
  const { user } = useAuth();
  const talentAuth = loadTalentAuth();
  const isTalentPortal = !!talentAuth;
  const userId =
    user?.role === "talent" || user?.role === "client"
      ? (user?.id ?? null)
      : null;
  return () =>
    qc.invalidateQueries({ queryKey: ["unread-messages-count", isTalentPortal, userId] });
}
