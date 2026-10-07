/** Query-state destinations emitted by transactional-email links. Resource IDs are
 * selectors only; the destination page must still fetch them through its owned API. */
export function getDeepLinkResourceIds(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    offerId: params.get("offerId"),
    applicationId: params.get("applicationId"),
    interviewId: params.get("interviewId"),
    contractId: params.get("id"),
    threadId: params.get("thread"),
  };
}

export function matchesRequestedInterview(
  interview: { id: string; submissionId?: string; submission_id?: string } | null | undefined,
  requestedInterviewId: string | null,
  requestedApplicationId: string | null,
): boolean {
  if (!interview || !requestedInterviewId || interview.id !== requestedInterviewId) return false;
  const submissionId = interview.submissionId ?? interview.submission_id;
  return !requestedApplicationId || submissionId === requestedApplicationId;
}

export function shouldOpenTalentApplicationDrawer(
  applicationStatus: string | undefined,
  hasRequestedInterview: boolean,
): boolean {
  return applicationStatus !== "invited" && !hasRequestedInterview;
}
