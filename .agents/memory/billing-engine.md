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