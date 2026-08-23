---
name: Vetted badge
description: Admin-grantable "Vetted" badge on contractor profiles — schema, migrations, endpoints, and badge render surfaces.
---

# Vetted Badge

## Schema
Three new columns on `candidates` (startup migrations, all `ADD COLUMN IF NOT EXISTS`):
- `is_vetted boolean NOT NULL DEFAULT false`
- `vetted_at timestamptz` (nullable)
- `vetted_by_mechanism text` (nullable: `'manual_admin'` | `'automatic_milestone'`)

`admin_role_changes` gets a `change_type text NOT NULL DEFAULT 'role_change'` discriminator column.
Vetting audit rows use `change_type = 'vetting_status'`; the existing `new_role` column stores `'vetted'`/`'unvetted'`.

## Platform settings key
`vetted_auto_hire_threshold` — not seeded at startup; auto-promotion is dormant until a real integer value is stored.
The hire-count proxy is `hiring_contracts.onspot_signed_at IS NOT NULL`.

## Endpoints
- `GET /api/admin/talent/:id/vetted-eligibility` — returns `{isVetted, vettedAt, vettedByMechanism, completedHireCount, autoThreshold, meetsAutoThreshold}`. Gated to `talent_acquisition` sub-role.
- `PATCH /api/admin/talent/:id/vetted` — body `{action: 'grant'|'revoke', reason: string}`. Runs in a transaction; updates three candidate columns and inserts an `admin_role_changes` audit row. Same sub-role gate.

## sanitizeCandidate DTOs
- `sanitizeCandidate` (full DTO): passes through `isVetted` + `vettedAt` via the dual-key pattern (`c.isVetted ?? c.is_vetted ?? false`).
- `publicSanitizeCandidate`: passes through `isVetted` only (not `vettedAt` or mechanism — those are internal).

## Badge component
`TrustBadges.tsx` — `variant="vetted"`: Shield icon, indigo/purple palette (`#474EAD`), label "Vetted".

## Badge render surfaces
1. `TalentProfile.tsx` — pill row (same row as seniority + cultureScore badges). Uses inline `<Badge>` + `<Shield>` icon (no TrustBadge component — matches existing pill pattern). Guard: `(candidate as any).isVetted` (DTO always carries the field; cast avoids a TS gap from the very large candidate interface).
2. `TalentPool.tsx` — TalentCard label row. Inline `<span>` + `<ShieldCheck>` icon (ShieldCheck was already imported).
3. `SearchToShortlist.tsx` — ResultRow header area. Inline `<span>` + `<ShieldCheck>` icon. `TalentResult.candidate` interface now has `isVetted?: boolean`.

## Admin UI
`AdminTalentDetail.tsx` — "Vetted Status" card in the left column (below Stats card):
- Shows current status, completed hire count, auto-threshold progress (if configured), vetted-on date, and mechanism.
- Grant/Revoke button (toggles based on current status) with a required textarea reason field.
- Calls `authAPI.patch(...)` on submit; invalidates both the eligibility query and the main talent query on success.

**Why:** `authAPI.patch` at line 182 of `client/src/lib/api.ts` is the correct method for authenticated PATCH calls from admin pages.

## Known future work
- Vetted filter on the admin talent list page so admins can browse all vetted contractors at once.
- Vetting history/audit log tab on AdminTalentDetail showing who granted/revoked and when.
