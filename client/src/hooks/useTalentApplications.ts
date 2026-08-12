import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadTalentAuth } from "@/components/TalentLoginModal";

export interface ApplicationAnswer {
  questionId?: string;
  question: string;
  answer: string;
}

export interface TalentApplication {
  id: string;
  job: {
    id: string;
    title: string;
    companyName: string;
    location?: string;
    workSetup?: string;
    status?: string; // open | closed — for disabling "View Job" on closed roles
  };
  applicationStatus: string;
  submittedAt: string;
  updatedAt: string;
  resume?: { fileName?: string; url?: string };
  coverLetter?: string | null;
  answers?: ApplicationAnswer[] | null;
}

async function fetchTalentApplications(): Promise<TalentApplication[]> {
  const auth = loadTalentAuth();
  if (!auth) return [];
  const res = await fetch("/api/talent/applications", {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Shared hook for fetching the authenticated talent's application history.
 * Uses React Query with 15 s polling + refetch-on-window-focus so status
 * changes made by Admin appear automatically without a page reload.
 *
 * The query key includes candidateId so each account gets its own cache
 * entry — switching between talent accounts in the same browser never
 * leaks one candidate's data into another's badge or application list.
 */
export function useTalentApplications() {
  const auth = loadTalentAuth();
  return useQuery<TalentApplication[]>({
    queryKey: ["talent-applications", auth?.candidateId ?? null],
    queryFn: fetchTalentApplications,
    enabled: !!auth,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}

/**
 * Returns a callback to invalidate the talent applications cache for the
 * currently authenticated candidate only.
 * Call after submitting a new application so it appears immediately.
 */
export function useInvalidateTalentApplications() {
  const qc = useQueryClient();
  const auth = loadTalentAuth();
  return () =>
    qc.invalidateQueries({
      queryKey: ["talent-applications", auth?.candidateId ?? null],
    });
}

/**
 * Returns the count of applications whose `updatedAt` is newer than the
 * per-candidate "last viewed" timestamp stored in localStorage.
 * Returns 0 when:
 *  - no talent-only session exists (wrong auth path — badge is unsupported)
 *  - the talent has never visited My Applications (no baseline to compare against)
 */
export function useUnreadApplicationsCount(): number {
  const auth = loadTalentAuth();
  const { data: applications } = useTalentApplications();
  if (!auth || !applications || applications.length === 0) return 0;
  const raw = localStorage.getItem(getTalentAppsLastViewedKey(auth.candidateId));
  if (!raw) return 0; // never visited — no unread baseline
  const lastViewedMs = new Date(raw).getTime();
  return applications.filter(
    (app) => new Date(app.updatedAt).getTime() > lastViewedMs,
  ).length;
}


/**
 * Returns a per-candidate localStorage key for the "last viewed My Applications" timestamp.
 * Scoping by candidateId ensures one talent's visit doesn't erase another's unread baseline
 * when multiple accounts share the same browser profile.
 */
export function getTalentAppsLastViewedKey(candidateId: string): string {
  return `talent_apps_last_viewed_${candidateId}`;
}
