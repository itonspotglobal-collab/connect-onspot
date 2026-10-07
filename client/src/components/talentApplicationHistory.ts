export interface TalentStatusHistoryEvent {
  status: string;
  at: string;
}

export interface TalentHistoryTimelineEvent extends TalentStatusHistoryEvent {
  key: string;
}

/** Use recorded status changes plus the actual submission timestamp only. */
export function getTalentHistoryTimeline(
  statusHistory: TalentStatusHistoryEvent[] | null | undefined,
  submittedAt?: string | null,
): TalentHistoryTimelineEvent[] {
  const events = (statusHistory ?? [])
    .filter((event) => event.status && event.at && Number.isFinite(new Date(event.at).getTime()))
    .map((event, index) => ({ ...event, key: `history-${index}` }));
  const hasSubmittedEvent = events.some((event) => event.status === "submitted" || event.status === "new");
  if (submittedAt && !hasSubmittedEvent && Number.isFinite(new Date(submittedAt).getTime())) {
    events.push({ status: "submitted", at: submittedAt, key: "submitted-at" });
  }
  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
