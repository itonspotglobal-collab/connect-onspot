import {formatInterviewTime} from "./formatInterviewTime";

export interface AdvanceAvailability {
  available: boolean;
  reason: string | null;
}

export function getAdvanceAvailability(interview: any, now: Date | number = new Date()): AdvanceAvailability {
  const status = interview?.status;
  const outcome = interview?.outcome;
  const confirmed = interview?.confirmed_time ?? interview?.confirmedTime;
  const currentTime = typeof now === "number" ? now : now.getTime();
  if(outcome && outcome !== "pending")return {available:false,reason:"An outcome has already been recorded."};
  if (status === "completed" && outcome === "pending") return { available: true, reason: null };
  if (status === "confirmed" && confirmed && new Date(confirmed).getTime() <= currentTime) {
    return { available: true, reason: null };
  }
  if (status === "confirmed" && confirmed && Number.isFinite(new Date(confirmed).getTime())) {
    const formatted = formatInterviewTime(confirmed,interview.confirmed_time_zone??interview.confirmedTimeZone??"UTC");
    return { available: false, reason: `Available from ${formatted}.` };
  }
  if (status === "proposed" || status === "rescheduled") {
    return { available: false, reason: "Available once the talent confirms a time and the interview has started." };
  }
  return { available: false, reason: "Available once the confirmed interview has started." };
}
