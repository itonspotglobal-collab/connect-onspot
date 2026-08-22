---
name: Hiring pipeline — Phase 3
description: hiring_contracts endpoints — admin create/sign/void, talent view; OnSpot countersign execution trigger; signing model decisions.
---

## Signing model

- `talent_signed_at` — only the candidate-authenticated talent endpoint may record this; it does NOT trigger hired on its own.
- `onspot_signed_at` — admin-only countersignature; the contract executes only when both signatures are present.
- Fully signed contracts are immutable; void and reissue is required to change their document or terms.
- No `client_signed_at` — clients (the hiring companies) do not sign OnSpot contracts.
- `signing_entity` is snapshotted from `platform_settings('contract_signing_entity')` at contract creation time.

**Why:** Contracts are between the talent and OnSpot (the intermediary). The client company deals with OnSpot separately.

## Status flow

```
  offer_accepted → [POST contract] → contract_sent → [talent sign] → contract_sent
  → [admin OnSpot countersign] → signed → submission: hired
  → [PATCH void] → voided (only when status='sent', not after signed)
```

## Guard matrix

| Action | Guard | Response |
|---|---|---|
| POST contract | offer.status ≠ 'offer_accepted' | 409 cannot_create_contract |
| POST contract | active contract already exists | 409 contract_already_exists |
| PATCH sign | status = 'voided' | 409 contract_void |
| PATCH sign | status = 'signed' | 409 contract_signed |
| PATCH void | status = 'voided' | 409 already_voided |
| PATCH void | status = 'signed' | 409 cannot_void_signed |
| PATCH void | no reason body | 400 |

## Auth pattern

All `/api/admin/hiring-contracts/*` routes use `authenticateJWT` + inline `user.role !== "admin"` check → 403.
Consistent with `PATCH /api/admin/job-applications/:id`. BYPASS_ADMIN_AUTH does NOT apply (intentional).
Talent routes use the candidate JWT (`type: "candidate"`) plus a `talent_id` ownership check.

## Endpoint summary

| Endpoint | Auth | Notes |
|---|---|---|
| `POST /api/admin/hiring-contracts` | Admin JWT | Creates in 'sent' state; submission → contract_sent |
| `GET /api/admin/hiring-contracts?submissionId=` | Admin JWT | Any admin can see any contract |
| `PATCH /api/admin/hiring-contracts/:id/sign` | Admin JWT | body: `{ signerType: 'onspot', signedAt? }`; cannot fabricate the talent signature |
| `PATCH /api/admin/hiring-contracts/:id/void` | Admin JWT | body: `{ reason }` required |
| `GET /api/talent/hiring-contracts?submissionId=` | Talent JWT | Excludes voided; omits internal admin fields |
| `PATCH /api/talent/hiring-contracts/:id/sign` | Candidate JWT | Ownership-checked talent signature; shared transaction executes only after OnSpot countersign |

## Dev trace note

Cleanup order matters: `hiring_contracts` → `offers` → `job_submissions` (FK cascade not enabled).
