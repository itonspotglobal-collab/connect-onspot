---
name: Verified tier implementation
description: Full implementation of the Verified identity tier — DB schema, server endpoints, admin UI, contractor UI, and grandfathering.
---

## API gaps found and fixed (post-implementation audit)
- `GET /api/admin/talent` list query was missing `COALESCE(c.is_verified, false) AS is_verified` — added.
- `sanitizeSearchCandidate` and `sanitizeFullProfileForClient` in `server/lib/clientSearchSanitize.ts` were missing `isVerified` — added alongside `isVetted`.
- Without these, TalentPool and SearchToShortlist badge cards would never show the Verified pill even for verified contractors.

## Test script JWT claim requirements
- Admin JWT (`authenticateAdminFlexible`): **must include `email`** — line 570 of routes.ts checks `!decoded.email`.
- Talent JWT (`authenticateJWT` candidate path): **must include `email`** — line 270 uses email to look up user row; without it, the server falls back to using candidateId as userId, breaking `extractCandidateId`'s `WHERE user_id = $1` lookup.

## Canonical three-tier model
No Classification → Verified → Vetted

- **No Classification** — admin-facing label only; stored as `is_vetted=false`, `is_verified=false`
- **Verified** — admin confirmed identity doc; `is_verified=true` on `candidates` table
- **Vetted** — requires `is_verified=true` as a prerequisite; `is_vetted=true`

## DB columns (all on `candidates` table)
All added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` startup migration:
- `is_verified boolean NOT NULL DEFAULT false`
- `verified_at timestamptz`
- `verified_by text`
- `verified_by_mechanism text` — 'manual_admin' | 'grandfathered_pre_verified'
- `verification_notes text`
- `verification_status text` — 'pending' | 'rejected' | NULL (NULL = clean state)
- `verification_doc_url text` — deleted from storage on confirm/reject
- `verification_doc_name text` — display name only, persists on reject for UX
- `verification_rejection_reason text`

## Grandfathering rule
Startup migration: all `is_vetted=true` contractors with `is_verified=false` automatically get `is_verified=true, verified_by_mechanism='grandfathered_pre_verified'` plus an `admin_role_changes` audit row with `change_type='verification_status'`.

## Vetted prerequisite
`PATCH /api/admin/talent/:id/vetted` returns 422 if `action === 'grant' && !is_verified`.

## Access control
- Contractor endpoints: `authenticateJWT` (both regular and talent JWT tokens)
- Admin endpoints: `authenticateAdminFlexible + requireSuperAdmin` — Talent Acquisition cannot access
- Raw document view: mandatory write to `admin_file_access_log` before streaming — no exceptions

## Document retention policy
Raw ID document is deleted from object storage immediately after admin confirm or reject decision. Only `is_verified`, `verified_at`, `verified_by`, `verification_notes` survive confirmation. On reject: `verification_rejection_reason` survives (so contractor sees why).

## Audit trail
All events use `change_type = 'verification_status'` in `admin_role_changes` table (mirrors vetting which uses `'vetting_status'`).

## Endpoints added
- `GET  /api/talent/verification/status` — contractor's own status
- `POST /api/talent/verification/submit` — multipart `idDocument` upload (max 10MB, JPEG/PNG/PDF)
- `DELETE /api/talent/verification/submission` — cancel pending (deletes doc from storage)
- `GET  /api/admin/verification/queue` — Super Admin: pending queue
- `GET  /api/admin/talent/:id/verification-status` — Super Admin: status for one contractor
- `GET  /api/admin/talent/:id/verification-document` — Super Admin: stream raw doc + audit log
- `GET  /api/admin/talent/:id/verification-history` — Super Admin: audit trail
- `POST /api/admin/talent/:id/verification/confirm` — Super Admin: confirm + delete doc
- `POST /api/admin/talent/:id/verification/reject` — Super Admin: reject (reason required) + delete doc

## UI surfaces
- `TalentProfile.tsx` — green CheckCircle2 Verified pill before Vetted pill
- `TalentPool.tsx` — green CheckCircle2 inline badge before Vetted badge
- `SearchToShortlist.tsx` — green CheckCircle2 inline badge before Vetted badge
- `ProfileSettings.tsx` — Identity Verification section in Documents tab; shows upload/pending/rejected/verified states
- `AdminTalentDetail.tsx` — Verification Status card (before Vetted card); pending shows doc view button + confirm/reject actions; Super Admin only actions (gracefully 403 for sub-roles)
- `AdminVerification.tsx` — new page at `/admin/verification`; pending queue list linking to AdminTalentDetail
- `App.tsx` — `/admin/verification` route added

## Default badge fix
`TalentCard.tsx` had `verified = true` (fake badge on ALL cards). Fixed to `verified = false`.
`QuickTrustIndicators` in `TrustBadges.tsx` had `showVerified = true`. Fixed to `showVerified = false`.

**Why:** Defaults of `true` meant every contractor showed a false "OnSpot Verified" badge before any admin review.

## Helper function in server
`extractCandidateId(req)` — resolves candidate ID from either `type:'candidate'` talent JWT or standard talent JWT via users→candidates lookup. Used in all contractor verification endpoints.
