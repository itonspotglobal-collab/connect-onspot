// ─────────────────────────────────────────────────────────────────────────
// Pilot / Client configuration
//
// Lightweight, config-driven registry of pilot clients. Saddleman is the
// first pilot; additional clients can be onboarded by adding an entry to
// `PILOTS` — no other code should need to change.
// ─────────────────────────────────────────────────────────────────────────

export type PilotStatus = "pilot" | "active" | "inactive";

export interface PilotClientConfig {
  id: string;
  name: string;
  status: PilotStatus;
  brandPromise: string;
  clientMessage: string;
  talentMessage: string;
}

export const PILOTS: Record<string, PilotClientConfig> = {
  saddleman: {
    id: "saddleman",
    name: "Saddleman",
    status: "pilot",
    brandPromise: "Work Without Limits",
    clientMessage:
      "Hire on the spot. Build teams with confidence. Manage your workforce.",
    talentMessage:
      "Find work on the spot. Build a global career. Work without limits.",
  },
};

export const DEFAULT_PILOT_ID = "saddleman";

export function getPilot(id: string = DEFAULT_PILOT_ID): PilotClientConfig | undefined {
  return PILOTS[id];
}

export function getAllPilots(): PilotClientConfig[] {
  return Object.values(PILOTS);
}

export function getActivePilots(): PilotClientConfig[] {
  return getAllPilots().filter((p) => p.status === "pilot" || p.status === "active");
}

// Back-compat flat export — several pages already reference PILOT_CONFIG.*
// Keep it pointed at the default pilot so existing UI keeps working while
// new code should prefer getPilot(id).
export const PILOT_CONFIG = {
  pilotName: PILOTS[DEFAULT_PILOT_ID].name,
  clientType: "Pilot Client",
  brandPromise: PILOTS[DEFAULT_PILOT_ID].brandPromise,
  clientMessage: PILOTS[DEFAULT_PILOT_ID].clientMessage,
  talentMessage: PILOTS[DEFAULT_PILOT_ID].talentMessage,
};

// ─────────────────────────────────────────────────────────────────────────
// Pilot activity tracking (per-pilot, localStorage-backed)
// ─────────────────────────────────────────────────────────────────────────

const LS_PREFIX = "onspot_pilot_activity";
const LEGACY_LS_KEY = "onspot_pilot_activity"; // pre-multi-pilot flat key

export type PilotActivityKey =
  | "viewedHireTalent"
  | "searchedTalent"
  | "requestedShortlist"
  | "viewedFindWork"
  | "appliedToJob";

export const PILOT_ACTIVITY_LABELS: Record<PilotActivityKey, string> = {
  viewedHireTalent: "Viewed Hire Talent",
  searchedTalent: "Searched Talent",
  requestedShortlist: "Requested Shortlist",
  viewedFindWork: "Viewed Find Work",
  appliedToJob: "Applied To Job",
};

export const PILOT_ACTIVITY_ORDER: PilotActivityKey[] = [
  "viewedHireTalent",
  "searchedTalent",
  "requestedShortlist",
  "viewedFindWork",
  "appliedToJob",
];

function activityKeyFor(pilotId: string): string {
  return `${LS_PREFIX}_${pilotId}`;
}

function lastActivityKeyFor(pilotId: string): string {
  return `${LS_PREFIX}_${pilotId}_last`;
}

// One-time migration: data recorded before multi-pilot support was stored
// under a flat key with no pilot id. Fold it into the default pilot bucket.
let didMigrateLegacyActivity = false;
function migrateLegacyActivityOnce(): void {
  if (didMigrateLegacyActivity) return;
  didMigrateLegacyActivity = true;
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_LS_KEY);
    if (!legacyRaw) return;
    const defaultKey = activityKeyFor(DEFAULT_PILOT_ID);
    if (window.localStorage.getItem(defaultKey)) return; // already migrated
    window.localStorage.setItem(defaultKey, legacyRaw);
  } catch {
    // ignore storage errors
  }
}

export function trackPilotActivity(
  key: PilotActivityKey,
  pilotId: string = DEFAULT_PILOT_ID,
): void {
  try {
    migrateLegacyActivityOnce();
    const raw = window.localStorage.getItem(activityKeyFor(pilotId));
    const existing: Record<string, number> = raw ? JSON.parse(raw) : {};
    existing[key] = (existing[key] ?? 0) + 1;
    window.localStorage.setItem(activityKeyFor(pilotId), JSON.stringify(existing));
    window.localStorage.setItem(lastActivityKeyFor(pilotId), new Date().toISOString());
  } catch {
    // ignore storage errors
  }
}

export function getPilotActivity(
  pilotId: string = DEFAULT_PILOT_ID,
): Partial<Record<PilotActivityKey, number>> {
  try {
    migrateLegacyActivityOnce();
    const raw = window.localStorage.getItem(activityKeyFor(pilotId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getPilotLastActivity(pilotId: string = DEFAULT_PILOT_ID): string | null {
  try {
    return window.localStorage.getItem(lastActivityKeyFor(pilotId));
  } catch {
    return null;
  }
}

export function getPilotActivityTotal(pilotId: string = DEFAULT_PILOT_ID): number {
  const activity = getPilotActivity(pilotId);
  return Object.values(activity).reduce((sum, n) => sum + (n ?? 0), 0);
}
