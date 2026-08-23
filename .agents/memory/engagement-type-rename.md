---
name: Engagement type rename — Half-Day/Full-Time → Lite/Standard
description: Documents the canonical values, migration approach, and all storage locations for the 2026-08-23 rename.
---

## Canonical values (current)
- `'Standard'` — 8 hrs/day, 40 hrs/week (was `'Full-Time'`)
- `'Lite'`     — 4 hrs/day, 20 hrs/week (was `'Half-Day'`)

## Storage locations holding these values
| Location | Column | Type | Constraint |
|---|---|---|---|
| `jobs` | `engagement_type` | text, nullable | CHECK IN ('Lite','Standard') or NULL |
| `offers` | `engagement_type` | text, NOT NULL | CHECK IN ('Lite','Standard') |
| `offers` | `talent_expected_engagement` | text, nullable | none |
| `candidates` | `preferences->>'rateEngagementType'` | JSONB | none |

## Migration history (2026-08-23)
- Phase 1 (DB-pane): dropped old CHECK constraints, renamed all 18 rows
- Phase 2 (code): startup migrations add backwards-compat normalization then rebuild constraints

## Startup migration invariant
The startup migration (server/routes.ts) normalises old labels → new ones BEFORE checking/adding the CHECK constraint.
Order: normalize 'full-time'→'Standard', 'part-time'→'Lite', 'Full-Time'→'Standard', 'Half-Day'→'Lite', then drop+recreate constraint.
Same pattern for offers. This is the safe order — data first, constraint after.

**Why:** CHECK constraints blocked Phase 1 data updates until they were dropped first; established the drop-then-rename-then-add pattern for future value renames.

**How to apply:** Any future engagement-type value rename must: (1) drop constraint in DB pane, (2) rename data, (3) ship code with backwards-compat normalization in startup migration before the new constraint DDL.

## Legal copy (confirmed wording)
- LegalPolicyContent.tsx §8: "in Lite (4-hour) or Standard (8-hour) increments"
- TermsAndConditions.tsx §8.1: "fixed Lite (4-hour) or Standard (8-hour) increments"
