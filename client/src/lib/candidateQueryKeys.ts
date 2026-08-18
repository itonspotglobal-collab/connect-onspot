/**
 * candidateQueryKeys — canonical React Query keys for candidate data.
 *
 * Always normalises the ID to a string so that a candidateId that arrives as a
 * number from the server JSON (e.g. 123) and the same ID that arrives as a URL
 * param string ("123") produce the same cache key, preventing the stale-cache
 * bug caused by React Query treating ["candidate-profile", 123] and
 * ["candidate-profile", "123"] as two different entries.
 */

export const candidateQueryKeys = {
  /**
   * Used by TalentProfile.tsx:
   *   useQuery({ queryKey: ["/api/candidates", id], ... })
   */
  detail: (candidateId: string | number) =>
    ["/api/candidates", String(candidateId)] as const,

  /**
   * Used by useCandidateProfileSettings.ts (and ProfileSettings.tsx via that hook):
   *   useQuery({ queryKey: ["candidate-profile", candidateId], ... })
   */
  profile: (candidateId: string | number) =>
    ["candidate-profile", String(candidateId)] as const,

  /**
   * Legacy resume-status key used by GetHired / useTalentProfile.
   * Not keyed on candidateId — the endpoint resolves it server-side via JWT email.
   */
  resumeStatus: ["/api/talent/me/resume-status"] as const,
} as const;
