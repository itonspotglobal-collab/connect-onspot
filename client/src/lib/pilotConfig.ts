export const PILOT_CONFIG = {
  pilotName: "Saddleman",
  clientType: "Pilot Client",
  brandPromise: "Work Without Limits",
  clientMessage: "Hire on the spot. Build teams with confidence. Manage your workforce.",
  talentMessage: "Find work on the spot. Build a global career. Work without limits.",
};

const LS_KEY = "onspot_pilot_activity";

export type PilotActivityKey =
  | "viewedHireTalent"
  | "searchedTalent"
  | "requestedShortlist"
  | "viewedFindWork"
  | "appliedToJob";

export function trackPilotActivity(key: PilotActivityKey): void {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    const existing: Record<string, number> = raw ? JSON.parse(raw) : {};
    existing[key] = (existing[key] ?? 0) + 1;
    window.localStorage.setItem(LS_KEY, JSON.stringify(existing));
  } catch {
    // ignore storage errors
  }
}

export function getPilotActivity(): Partial<Record<PilotActivityKey, number>> {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
