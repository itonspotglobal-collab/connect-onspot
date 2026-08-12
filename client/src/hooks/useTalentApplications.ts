import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadTalentAuth } from "@/components/TalentLoginModal";

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
  resume?: { fileName?: string };
  coverLetter?: string | null;
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
 */
export function useTalentApplications() {
  const auth = loadTalentAuth();
  return useQuery<TalentApplication[]>({
    queryKey: ["talent-applications"],
    queryFn: fetchTalentApplications,
    enabled: !!auth,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}

/**
 * Returns a callback to invalidate the talent applications cache.
 * Call after submitting a new application so it appears immediately.
 */
export function useInvalidateTalentApplications() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["talent-applications"] });
}
