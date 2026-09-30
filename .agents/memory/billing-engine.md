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

## Marketplace custody boundary

The intended future payments architecture is provider-managed marketplace payments: both Client and Talent connect their own provider accounts, while OnSpot never directly holds or moves funds. Keep provider connections vendor-neutral and separate from existing manual invoice and payout references; absence of a connection record means not connected.

**Why:** The provider, not OnSpot, will handle charges, transfers, and KYC/compliance. Legacy vendor-specific user fields and manual reference fields must not become the foundation for this model.

**How to apply:** Future payment integration work should use the billing parties' user identities, preserve existing semi-manual ledger states until a deliberate migration, and never infer that a stored provider reference proves a charge or transfer succeeded.

## Independent-contractor invoice cadence

The confirmed new model is Talent-to-OnSpot independent-contractor invoicing, not payroll: calendar-aligned invoice periods run from the 1st–15th (payment date the 25th) and 16th–month-end (payment date the 5th of the following month), using US Eastern Time as the canonical cutoff clock. OnSpot's separate Client invoice groups the month's eligible Talent invoice periods, with commission bundled into the Client's all-in amount. A Talent invoice is mechanically generated from an approved timesheet revision; actual hours originate from real-time Time In / Time Out events in the platform, never retrospective manual hour entry. Talent may edit/dispute the derived timesheet subject to approval, but never claims or edits the invoice amount.

**Why:** The Client security deposit, not timing of Client invoice payment, is the intended backstop for the Talent payment commitment. A pending deposit does not prove coverage, and a scheduled payout does not prove execution. The earlier claimed/computed/approved invoice-amount proposal was superseded; corrections belong in the timesheet. A missed clock-out must remain an explicit exception rather than silently contributing unverified hours.

**How to apply:** Capture absolute, server-side clock instants and resolve missing ends through an audited approval workflow before an invoice can depend on those hours. Draft the invoice after each window from the approved timesheet, notify Talent, then auto-send after 48 hours even if a timesheet dispute is pending. Approved corrections after send use a signed credit memo on the next available draft instead of changing sent financial history. Do not require Client payment before authorizing the new Talent invoice path; document the deposit-backed reason, verify coverage, preserve legacy records, and avoid payroll-adjacent names or comments.

## Parallel engagement modes

Clients must choose between Tracked (clock-derived, approved timesheets with extended-hour/deduction adjustments) and Guaranteed (no clock requirement, agreed flat period amount with no attendance adjustments). Approved leave preserves the guarantee; only substantiated total non-performance/abandonment for the period removes it.

**Why:** In Guaranteed mode, the absence of clock events is intentional and must not be mistaken for missing attendance. A Client allegation alone is not sufficient to withhold a Talent invoice; OnSpot must review it.

**How to apply:** Keep Tracked and Guaranteed generation paths separate. For Guaranteed mode, provide a period-specific Client non-performance claim and OnSpot decision before withholding a period's invoice; never apply Tracked timesheet-hour calculations to a Guaranteed period. Do not infer the mode of legacy contracts without an explicit selection.

## Late Guaranteed claims and contract endings

A substantiated late Guaranteed claim after the Talent invoice is sent creates a separate Client-side credit against the original period's all-in charge, never a Talent credit memo or a change to the sent Talent invoice. If the original Client statement was sent, apply it to the next eligible unsent statement, not to historical sent statements.

**Why:** The guaranteed Talent commitment survives a late Client discovery, while the Client still needs a reviewed remedy. The two financial histories must remain independently auditable. The user explicitly confirmed that Client credits must never alter sent Talent invoices or payouts.

**How to apply:** Keep Client credit applications distinct from Tracked Talent corrections; require an Admin finding, preserve original invoice snapshots, and do not post a credit to a statement older than the finding unless it is the original unsent statement. Signed-contract termination is a separate lifecycle feature, not a silent cutoff invented by the invoice worker.

An approved termination records an immutable effective end date on the signed contract; its inclusive final service date can still be in the future or leave a partial last invoice window. Keep the contract eligible for billing only through that agreed date, not as an immediate cancellation of accrued invoices or payouts. Keep the held deposit until final-period Client statement and Talent payouts are settled; do not rewrite sent records.

**Why:** A status-only stop would lose earned final-period obligations, while continuing all signed-contract automation beyond the agreed end creates unearned charges.

**How to apply:** Check both lifecycle state and effective end date in clock, timesheet, invoice, payout, statement, and deposit paths. Serialize termination approval with invoice drafting on the contract row and require explicit review for clipped Tracked revisions.


## Contract ending and rollout gate

Final termination ends an engagement without requiring another contract. A billing-mode switch must use the same immutable contract-end boundary and then a newly offered and signed contract for the new mode; it must never edit the old signed mode or sent financial records. Do not release the two-mode billing foundation into production without a working formal end path in the same release.

**Why:** An open-ended signed contract otherwise continues generating financial obligations indefinitely. The user expressly confirmed this separation and the combined-release gate.

**How to apply:** Require an explicit approved effective end, settle the inclusive final service period, and preserve sent ledger history. Reverify the actual production database's migration state independently before any publish; route 404s alone are not schema evidence.

## Production billing migration gate

Do not publish billing and termination until production schema synchronization, the ordered custom-SQL migrations, and their ledger have a verified non-colliding sequence. A table/column diff is not evidence that financial immutability functions and triggers are installed. Require a rehearsed recovery plan and explicit approval before production changes.

**Why:** An earlier publish-time schema diff ran before the app's startup migrations could normalize production data; this recurrence could leave financial records unprotected or make the deployment fail at startup.

**How to apply:** Confirm whether the actual live database is Replit-managed or external, use only its authorized migration channel, rehearse on an isolated equivalent database, inspect the remaining publish diff and enabled trigger definitions, and keep publish blocked if any gate is unproven. If Replit controls and documentation cannot definitively resolve ownership, seek a direct answer from Replit support; never infer it from the database hostname.


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
