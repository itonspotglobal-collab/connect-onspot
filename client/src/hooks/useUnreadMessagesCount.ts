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

async function fetchUnreadMessageCount(userId: string): Promise<number> {
  const token = getBearerToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
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

  // talentAuth.candidateId is the user_id (confusingly named in the JWT payload)
  const userId =
    talentAuth?.candidateId ??
    (user?.role === "talent" ? user?.id : null);

  const { data: count = 0 } = useQuery<number>({
    queryKey: ["unread-messages-count", userId],
    queryFn: () => fetchUnreadMessageCount(userId!),
    enabled: !!userId,
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
  const userId =
    talentAuth?.candidateId ??
    (user?.role === "talent" ? user?.id : null);
  return () =>
    qc.invalidateQueries({ queryKey: ["unread-messages-count", userId] });
}
