/**
 * candidateCache — shared helpers for immediate React Query cache updates
 * and canonical invalidation of every query key that represents the same
 * candidate record.
 *
 * Use these in every resume/video/photo mutation so that TalentProfile,
 * ProfileSettings, and GetHired all reflect changes without a browser refresh.
 */

import type { QueryClient } from "@tanstack/react-query";
import { candidateQueryKeys } from "./candidateQueryKeys";

/**
 * Immediately write resume fields into every candidate cache entry so the UI
 * updates before the subsequent invalidation/refetch completes.
 *
 * Call this right after parsing the server's JSON response; do NOT wait for it
 * before showing success feedback to the user.
 */
export function setCandidateResumeCache(
  queryClient: QueryClient,
  candidateId: string | number,
  resume: { resumeUrl: string | null; resumeFileName: string | null },
): void {
  const updater = (old: any) =>
    old
      ? { ...old, resumeUrl: resume.resumeUrl, resumeFileName: resume.resumeFileName }
      : old;

  queryClient.setQueryData(candidateQueryKeys.detail(candidateId), updater);
  queryClient.setQueryData(candidateQueryKeys.profile(candidateId), updater);
}

/**
 * Invalidate every known query key that holds candidate data so the next
 * render triggers a background refetch and picks up the canonical server state.
 *
 * Fire-and-forget after setCandidateResumeCache — the UI is already correct;
 * this just keeps the cache consistent with the server.
 */
export async function invalidateCandidateQueries(
  queryClient: QueryClient,
  candidateId: string | number,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: candidateQueryKeys.detail(candidateId) }),
    queryClient.invalidateQueries({ queryKey: candidateQueryKeys.profile(candidateId) }),
    queryClient.invalidateQueries({ queryKey: candidateQueryKeys.resumeStatus }),
    // Speculative keys that some pages use for broader candidate invalidation
    queryClient.invalidateQueries({ queryKey: ["candidate", String(candidateId)] }),
    queryClient.invalidateQueries({ queryKey: ["/api/candidates/me"] }),
  ]);
}
