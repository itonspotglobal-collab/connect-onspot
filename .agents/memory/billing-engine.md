---
name: Billing engine — Payments/Invoicing
description: Phase 1 schema, pure functions, and security deposit lifecycle for the OnSpot Payments engine.
---

## Money model (confirmed, do not re-derive)
- Client pays OnSpot → OnSpot pays Talent. No direct Client→Talent rail.
- Commission = 20% (stored as `commission_rate` decimal on every row — NOT hardcoded).
- Commission added ON TOP of talent rate; never deducted from it.
- Client sees one all-in number; commission is never itemized.
- Talent always receives their full agreed rate (±rate-adjustment engine only).
- GTV = Revenue: full client billing is top-line (commission is gross margin).

## Rate-adjustment engine
- Standard = 8h/day × 20 working days = **160 h/month**
- Lite = 4h/day × 20 working days = **80 h/month**
- `hourlyEquivalent = talentRate / standardPeriodHours` — for extended/deduction adjustments ONLY
- `adjustedTalentPayout = talentRate + (extendedHours − deductionHours) × hourlyEquivalent`
- `clientInvoiceAmount = adjustedTalentPayout × (1 + commissionRate)`
- All derived values stored explicitly on `invoice_periods` rows — never recomputed from first principles at read time.
- Pure functions live in `server/lib/billing.ts`; import from there everywhere.

## Security deposit
- Amount = `(talentRate / 20) × 30` = talentRate × 1.5 (30 days of daily rate)
- `platform_settings.deposit_cure_period_days = 5` (Super-Admin-updatable; never hardcode)

## Security deposit escalation ladder (locked)
| Event | Status | Key fields |
|---|---|---|
| Contract active, deposit collected | `pending → held` | `held_at` |
| Invoice unpaid; drawn to pay talent | `held → drawn` | `drawn_at`, `drawn_reason`, `replenishment_due_at = drawn_at + 5d` |
| Day 5, still unresolved | `drawn → replenishment_pending` | — |
| Day 15 (suspension) | `replenishment_pending → suspended` | `suspended_at`, `cure_deadline_at = suspended_at + cure_period_days` |
| Client cures in window | `suspended → held` | `cure_deadline_at` cleared |
| Day 20 (cure expired) | `suspended → forfeited` | `forfeited_at`, `terminal_reason = 'nonpayment_breach'` |
| Normal/mutual termination | `held → applied` | `notice_given_at`, `applied_at`, `applied_to_invoice_id`, `terminal_reason = 'normal_termination'` |

**CRITICAL:** `terminal_reason` is the disambiguation field. `forfeited` applies ONLY when `terminal_reason = 'nonpayment_breach'`. Any other termination path → `applied`.

## Tables created (Phase 1)
1. `payout_region_configs` — per-region rail config; PH seeded (bank_transfer/gcash/wise)
2. `invoice_periods` — ledger spine; one row per billing cycle per contract
3. `invoices` — client-facing document; invoice_number_seq for INV-YYYY-NNNN format
4. `payouts` — talent-facing disbursement
5. `security_deposits` — one per hiring_contract (UNIQUE FK)

## Key schema decisions
- `invoice_periods.commission_rate` stored as `numeric(5,4)` — explicit per-row, not a constant.
- `invoices.commission_rate` copied from period row for auditability at payment time.
- `invoices.client_id` is NOT NULL — must be derived from `hiring_contract → job_submission.client_id` when creating.
- `security_deposits.applied_to_invoice_id` FK to `invoices` — invoices table must be created before security_deposits in migration order.
- `payouts.payout_region` FK to `payout_region_configs(region_code)` — add new regions as data rows, never code changes.

## E2E evidence
`scripts/verify-billing-phase1.ts` — 10 steps, all pass. Tests: commission math, period hours, rate-adjustment engine, deposit calculation, full security_deposit status lifecycle (both paths), DB persistence of all amounts.

**Why:** future Loyalty-tier discount = compute a different commission_rate and write it into the field. No schema changes needed.
