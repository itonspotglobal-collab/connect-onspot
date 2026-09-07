export type ClientInterviewDisplayState =
  | "awaiting_talent"
  | "action_required"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "rescheduled";

export function getClientInterviewDisplayState(interview: {
  status: string;
  confirmed_time?: string | null;
  current_proposal_owner?: string | null;
}): ClientInterviewDisplayState {
  if (interview.status === "confirmed" || interview.confirmed_time) return "confirmed";
  if (interview.status === "completed") return "completed";
  if (interview.status === "cancelled") return "cancelled";
  if (["proposed", "rescheduled"].includes(interview.status)) {
    return interview.current_proposal_owner === "client"
      ? "action_required"
      : "awaiting_talent";
  }
  return "rescheduled";
}