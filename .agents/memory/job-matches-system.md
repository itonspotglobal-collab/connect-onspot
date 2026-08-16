---
name: Job matches system
description: How the persisted job_matches table, server scorer, and event-driven recompute work together.
---

## Architecture (Option C — event-driven dual-trigger)

- `job_matches` table: `talent_id` (FK candidates.id), `job_id` (FK jobs.id), `compatibility_score` INT, `match_reasons` JSONB, `computed_at`, `notified_at`. Unique on (talent_id, job_id).
- Scorer lives in `DbStorage.scoreJobForCandidate()` (private) — pure function, no DB calls.
- `calculateJobMatches(userId)` computes + awaits `persistMatchResults` (NOT fire-and-forget — must await or callers get stale data).
- `GET /api/talent/matches` (behind `authenticateTalentJWT`): reads from `job_matches`; on empty, calls `recomputeMatchesForTalent` then re-reads.

## Trigger A — profile/candidate save
- `PUT /api/profiles/me`: after `res.json(...)`, `setImmediate` → `recomputeMatchesForTalent(candidateId)`.
- `PATCH /api/candidates/:id`: after `res.json(sanitizeCandidate(updated))`, `setImmediate` → `recomputeMatchesForTalent(profileId)`.

## Trigger B — new job published
- `POST /api/admin/jobs`: after `res.status(201).json(job)`, `setImmediate` → `recomputeMatchesForJob(job.id)`.
- `recomputeMatchesForJob` fans out: 1 job × all candidates with user_id. At 16 candidates this is synchronous; queue it when > 1,000 candidates.

## Notification threshold: raw score ≥ 70
- Prevents noise from recency/timezone padding alone (max bonuses without skills = 55 raw).
- `persistMatchResults` fires in-app notification only for NEW high-score matches (not previously notified).

## Score display cap: Math.min(100, score) at render only
- `compatibility_score` stored raw (unbounded). UI caps at 100.

## Key race condition (FIXED)
- `persistMatchResults` must be AWAITED in `calculateJobMatches` — fire-and-forget caused `getJobMatchesForTalent` to return [] immediately after recompute.

## Scorer components (maximum additive score, no-skills talent)
| Signal | Points |
|--------|--------|
| Jaccard skill overlap (0-100%) | 0–100 |
| Engagement type match | +20 |
| Rate within ±20%, same currency | +10 |
| Category/industry match | +10 |
| Experience tier within ±1 level | +10 |
| Timezone exact | +15 |
| Timezone region | +5 |
| Posted ≤ 3 days | +10 |
| Posted ≤ 7 days | +5 |

## Client scorer (FindBestMatches.tsx) — NOT replaced
Different philosophy (position relevance + domain gates vs Jaccard-first). The Recommended feed is a separate surface. Scorer unification is a future task.

## Talent token for GET /api/talent/matches
`authenticateTalentJWT` only accepts `{type:"candidate",candidateId,email}` tokens (stored as `talent_profile_token.token` in localStorage). TalentPortal.tsx derives it with `JSON.parse(localStorage.getItem("talent_profile_token"))?.token`.
