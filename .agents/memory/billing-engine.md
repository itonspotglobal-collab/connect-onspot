---
name: Billing engine invariants
description: Durable money, identity, lifecycle, and concurrency rules for billing records.
---

## Money and identity rules

- Client billing is the talent payout plus an explicit commission rate; never hardcode a commission literal in a route or infer it from totals.
- Every ledger party must be derived server-side from the linked contract and job submission. Request bodies must not choose invoice clients or payout talent.
- Persist calculated period amounts as snapshots. Read paths should report stored values rather than silently re-deriving financial history.

**Why:** Billing records are financial history, so changing an offer or trusting client-provided identity after creation can corrupt reconciliation.

**How to apply:** Use the pure billing functions when creating a period, copy their commission output into every related financial row, and join through the contract/submission for party identity.

## Contract activation and deposits

- A fully signed contract must create exactly one pending security deposit in the same transaction as activation.
- Deposit escalation is ordered: `pending → held → drawn → replenishment_pending → suspended → held|forfeited`; normal or mutual termination uses `held → applied`.
- Forfeiture is valid only with terminal reason `nonpayment_breach`; other terminal paths must not be recorded as forfeiture.

**Why:** The ledger must not show an active contract without its deposit, and terminal reasons distinguish nonpayment recovery from ordinary termination.

**How to apply:** Keep activation and the initial deposit insert atomic, enforce transitions server-side, and validate terminal reasons before writing terminal timestamps.

## Ledger concurrency

- Billing periods are unique per hiring contract and date range, with the uniqueness enforced by the database as well as a friendly duplicate check.

**Why:** Two simultaneous admin requests can both pass an application-level existence check.

**How to apply:** Keep the duplicate check and insert transactional, retain the unique index, and translate a unique-conflict error into a safe conflict response.


## Customer-facing ledger views

Customer invoice and talent payout responses must use explicit public-field allow-lists. Never expose commission fields, internal references, admin notes, or failure details; customer payment instructions are separate from those internal fields, with card links accepted only as http(s) URLs.

**Why:** The billing tables intentionally contain audit and operations data that is not part of either audience's self-service view. Keeping public serialization separate prevents accidental leakage as the ledger grows.

**How to apply:** Any future client invoice or talent payout endpoint should filter ownership in SQL and serialize only customer-facing fields before returning JSON.
## Phase 3 surface — client invoice view + talent payout history

- `GET /api/client/invoices` — `authenticateJWT` + `role==="client"`, filters by `invoices.client_id`; joins `invoice_periods`, `offers`, talent `users`. Page: `client/src/pages/ClientInvoices.tsx` at client route `/payments`.
- `GET /api/talent/payouts` — `authenticateJWT` (main auth system, not talent-JWT), filters by `payouts.talent_id`; joins `invoice_periods`, `offers`, client `users`. Page: `client/src/pages/TalentPayouts.tsx` at `/hired-talent-portal/payouts`.
- Talent payouts route added *before* `/hired-talent-portal` in `TalentRouter` — wouter Switch is first-match, so specificity order matters.
- "Earnings" link added to `managementItems` in `HiredTalentPortal.tsx`; `Wallet` icon imported from lucide-react.
- `scripts/verify-billing-phase3.ts` — 32/32 pass (client filtering, talent filtering, cross-tenant isolation, status transitions, empty-state).
- pg DATE columns return JS Date objects at runtime, not strings — check `!= null`, not `typeof === "string"`.
