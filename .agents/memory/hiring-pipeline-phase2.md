---
name: Hiring pipeline — Phase 2
description: Offer endpoints (POST/GET client, GET/PATCH talent), rate mismatch computation, engagement_type snapshot, talent respond flow.
---

## Key decisions

- `engagement_type` is snapshotted from `jobs.engagement_type` at offer-creation time; never from request body.
- Valid `engagement_type` values: `'Half-Day'` | `'Full-Time'` (enforced by offers table CHECK constraint).
- Talent rate expectations stored in `candidates.preferences` JSONB: keys `rateAmount`, `rateCurrency`, `rateEngagementType`.
- `job_submissions.talent_id` is `users.id` (not `candidates.id`); resolve to candidate preferences via `candidates.user_id`.
- `rate_below_expectation` / `rate_delta` are NULL when currencies differ, engagement types differ, or expectation not set — no fake FX conversion.
- `rate_delta = offerRate - talentExpectedRate` (negative = below expectation).
- Talent GET view deliberately omits `rate_below_expectation`, `rate_delta`, `talent_expected_*` — client-internal analytics only.
- Offer `status` column is plain text (no CHECK constraint) — values: `sent`, `offer_accepted`, `offer_declined`.

## Endpoint summary

| Endpoint | Auth | Guard |
|---|---|---|
| `POST /api/client/offers` | JWT (any role; ownership via client_id) | submission must be shortlisted/reviewed/under_review/interviewing |
| `GET /api/client/offers?submissionId=` | JWT | ownership via client_id |
| `GET /api/talent/offers/:id` | JWT (talent/candidate) | ownership via talent_id on submission |
| `PATCH /api/talent/offers/:id/respond` | JWT (talent/candidate) | ownership + offer must be `sent` |

## Status side-effects

- `POST /api/client/offers` → submission: any eligible → `offer_extended`
- `PATCH respond action=accept` → offer: `offer_accepted`; submission: `offer_accepted`
- `PATCH respond action=decline` → offer: `offer_declined`; submission: `offer_declined`
- All side-effects write audit trail to `job_application_status_history`.

## Test JWT note

Real client users must be used for client endpoint traces — `authenticateJWT` validates role against DB. `test-user-1` is `role=admin` in dev DB, not `role=client`. Use `1779697322933_iw3h9irnh` (val.testclient@onspotglobal.com) for client token in dev traces.

**Why:** JWT middleware does a DB lookup and compares roles; mismatched role → 401 "User role has changed".
