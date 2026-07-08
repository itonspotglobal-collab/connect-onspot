// ─────────────────────────────────────────────────────────────────────────
// Pilot / client filtering placeholders
//
// The `jobs` and `candidates` tables don't have a `clientId`/`pilotId`
// column tying a record to a pilot client yet (the `clientId` on jobs is
// the internal user id of the employer who posted it, not a pilot client
// key). Until that backend support exists, these helpers provide a
// frontend-safe way to associate records with a pilot by matching on
// company name — the same shape callers will use once real `pilotId`
// columns are added, so swapping the implementation later is a one-line
// change with no call-site churn.
// ─────────────────────────────────────────────────────────────────────────

import type { Job, Candidate } from "@shared/schema";
import { PILOTS, type PilotClientConfig } from "./pilotConfig";

// Any record type that may eventually carry a real pilotId/clientId column.
type PilotTaggable = { pilotId?: string | null; clientId?: string | null };

function matchesPilotByCompanyName(company: string | null | undefined, pilot: PilotClientConfig): boolean {
  if (!company) return false;
  return company.trim().toLowerCase() === pilot.name.trim().toLowerCase();
}

/**
 * Best-effort resolution of which pilot (if any) a job belongs to.
 * Prefers an explicit pilotId field if one is ever added to the schema;
 * falls back to a company-name heuristic in the meantime.
 */
export function getJobPilotId(job: (Job & Partial<PilotTaggable>) | null | undefined): string | null {
  if (!job) return null;
  if (job.pilotId) return job.pilotId;
  for (const pilot of Object.values(PILOTS)) {
    if (matchesPilotByCompanyName((job as Job).company, pilot)) return pilot.id;
  }
  return null;
}

export function filterJobsByPilot(jobs: Job[], pilotId: string): Job[] {
  return jobs.filter((job) => getJobPilotId(job) === pilotId);
}

/**
 * Best-effort resolution of which pilot (if any) a candidate is associated
 * with. No signal exists on the candidate record today, so this currently
 * always returns null — it exists so call sites are ready for a real
 * `pilotId` column without needing to change again later.
 */
export function getCandidatePilotId(
  candidate: (Candidate & Partial<PilotTaggable>) | null | undefined,
): string | null {
  if (!candidate) return null;
  if (candidate.pilotId) return candidate.pilotId;
  return null;
}

export function filterCandidatesByPilot(candidates: Candidate[], pilotId: string): Candidate[] {
  return candidates.filter((candidate) => getCandidatePilotId(candidate) === pilotId);
}
