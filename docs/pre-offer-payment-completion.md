# Mandatory pre-offer payment: implementation and verification report

## 1. Existing functionality confirmed

The audit is in `docs/pre-offer-payment-audit.md`. The existing canonical hiring
record, formal eligibility predicate, initial offers, Client/Talent counteroffers,
expiry/renewal, private contract documents, hash-bound consent, signing and
execution were retained. Organic applications and accepted Client invitations
remain on their original `job_submissions` records. There is no new universal
interview prerequisite.

Contract execution remains responsible for `contract_sent` → `hired`, billing
activation and the security deposit. The pre-offer payment service cannot perform
those transitions. Existing engagement invoices, Talent invoices, payout
calculations and the Talent Vetting Quiz were not rewritten.

## 2. Missing functionality identified and completed

Previously there was no persisted pre-offer intent, authorized hiring-fee policy,
separate hiring invoice, independent settlement review, or mandatory server-side
payment guard. Existing Client invoice screens and the Admin ledger could be
reused as containers, but recurring financial records were not suitable for
this charge.

The implementation adds:

- Idempotent Ready for Offer intent and invoice issuance on the original eligible
  application, with ownership, stage and job billing-classification validation.
- An explicit, immutable, Super-Admin-authorized fixed-per-attempt policy.
  Amount, USD currency, fee description/basis, inclusive/exempt tax treatment,
  due terms, recipient and manual-transfer instructions are required. No policy
  or pricing was seeded; missing configuration blocks issuance.
- Invoice snapshots, one active invoice per attempt, append-only events,
  independent manual verification and unique settled-transaction references.
- Server guards in the existing initial offer, both counteroffer writers and
  Client/Admin renewal service. A database trigger additionally protects offer
  inserts, new-send transitions, deadline extensions and submission-identity
  changes, including elevated direct writes.
- Reuse of a valid paid invoice for the same original attempt. Void, refund or
  invalidation cannot authorize a subsequent offer. Reversals create review
  exceptions without rewriting accepted offers or contracts.

## 3. Database changes

Additive migration: `migrations/0038_hiring_pre_offer_payment.sql`.
Matching ORM declarations are in `shared/schema.ts`.

| New entity | Purpose |
| --- | --- |
| `hiring_fee_policies` | Authorized immutable policy versions |
| `hiring_payment_attempts` | One persisted intent per original submission |
| `hiring_pre_offer_invoices` | Separate `hiring_pre_offer` fee snapshots and verification |
| `hiring_payment_events` | Append-only issuance/reference/review audit history |
| `hiring_payment_exceptions` | Historical unknown payments and later reversals |

The migration adds new indexes, constraints, a numbering sequence and protective
triggers. It does not modify existing offer/contract/submission rows or existing
financial amounts. Historical offers receive explicit unknown-payment review
records, never fabricated paid invoices. Applying the migration twice was tested.
`SUBMISSION_STATUSES` was not expanded with financial statuses.

## 4. APIs and authorization

Implementation: `server/routes/hiringPayments.ts` and
`server/services/hiringPaymentService.ts`.

| Method/path | Access and behavior |
| --- | --- |
| `GET /api/client/hiring-invoices` | Client-owned invoices; optional original submission filter |
| `GET /api/client/hiring-invoices/:id` | Owning Client; safe invoice/history projection |
| `POST /api/client/hiring-invoices/ready` | Owning Client; original eligible submission; issue/reuse invoice |
| `POST /api/client/hiring-invoices/:id/reference` | Owning Client; unverified claim → `verification_pending` |
| `GET /api/admin/hiring-invoices` | Super Admin; Client/Talent/job/submission/status filters |
| `GET/POST /api/admin/hiring-invoices/policy` | Super Admin; inspect/configure policy versions |
| `GET /api/admin/hiring-invoices/exceptions` | Super Admin; read-only exception review |
| `GET /api/admin/hiring-invoices/:id` | Super Admin; complete review details/history |
| `POST /api/admin/hiring-invoices/:id/review` | Super Admin; verify/reject/void/refund/invalidate with reason |

Authorization checks the persisted user role and `admin_sub_role`; broad
development-auth or administrative access is not sufficient for settlement
verification. Talent and limited Admin subroles cannot read or confirm these
payments. Client responses exclude verifier identities, internal review details
and real Talent names that could bypass name-reveal rules.

The existing offer routes remain the actual offer writers. Payment errors are
mapped to a clear HTTP 409 conflict with code `PRE_OFFER_PAYMENT_REQUIRED`.
Transactions lock the original submission before the invoice/offer. The shared
formal predicate was moved unchanged to a pure module to make fixture injection
safe, not to introduce a second eligibility implementation.

## 5. Client, Admin and Talent UI

Client:

- Existing Client offer entry exposes Ready for Offer and persisted invoice
  progress; the existing offer dialog embeds payment controls.
- Invoice detail presents due terms, tax, amount and transfer instructions.
  Reference submission is clearly described as a claim requiring OnSpot review.
- Send Offer is disabled while payment is missing/pending or its status cannot
  be confirmed. A server conflict refreshes payment state and explains the lock.
- Separate pre-offer sections were added to both existing Client invoice
  screens. Paid invoices remain viewable.

Admin:

- The existing ledger now includes explicit policy configuration, invoice
  filters, review details, immutable history and historical exceptions.
- Independent verification fields start blank; expected invoice terms and the
  Client's unverified claim are shown separately. A reason and verification
  attestation are required.

Talent:

- No new private-billing UI or premature offer is created. Existing real
  Accept/Decline/Counteroffer and contract signing screens are reused.
- Client invoice and Admin reference-review notifications are role-routed;
  Talent's notification allow-list does not expose them.

## 6. Acceptance criterion demonstrated

Real PostgreSQL tests invoke the actual production offer handler, not a
replacement offer implementation, for both eligible organic and invitation cases:

| Same Client and original application | Actual result |
| --- | --- |
| No verified invoice | HTTP 409, `PRE_OFFER_PAYMENT_REQUIRED`; no offer created |
| Reference submitted, verification pending | HTTP 409, same code; no offer created |
| Authorized independent verification of matching amount/currency/recipient/reference | Existing offer POST returns HTTP 201 |
| Paid invoice for another application/job/Talent | Cannot authorize the offer |
| Invoice later reversed | Future offers/counters/renewals are blocked; existing history remains |

The paid offer then passes through actual Talent acceptance and the existing
private-PDF/consent/signature services. Partial signatures do not hire. Required
Talent, Client and OnSpot signatures execute once and create exactly one deposit.

## 7. Executed verification

Final results: **94 passing tests, no failing tests, one optional live
object-storage round-trip skipped.**

| Check | Result |
| --- | --- |
| New PostgreSQL payment/offer lifecycle fixtures | 14 passed |
| Existing contract-document PostgreSQL fixtures | 15 passed; optional external storage check skipped |
| Existing invoice calendars/amounts | 5 passed |
| Existing Talent-invoice USD guards | 2 passed |
| Existing currency and denomination-safe ledger summaries | 7 passed |
| Existing Client Team endpoint fixtures | 18 passed |
| Existing recorded-hour aggregation/provenance tests | 27 passed |
| Browser interactions using the real new components and existing offer dialog | 6 passed |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed; existing large-chunk/tooling warnings remain |
| `git diff --check` | Passed |
| Anonymous request to the running new Client invoice API | HTTP 401 |
| Native running-app screenshot of protected billing route | Sign-in remains required |

Additional database coverage includes concurrent issuance and offers, refund/offer
serialization, duplicate settlement references, direct elevated SQL inserts,
missing-policy and authorization failures, immutable evidence, decline/reoffer,
both counteroffer directions, expired offers, Admin-assisted renewal, historical
exceptions, cross-party isolation and execution/deposit idempotency.

Tests own disposable local PostgreSQL databases and credential-scrubbed workers.
The browser suite uses explicit disposable HTTP fixtures; it is not a real-bank
or production-login test. Signed-in production UI was **not** verified. The
private PDF service tests use an injected private byte store; no claim of a
successful live object-provider round-trip is made.

Reproduce:

```sh
node scripts/test-hiring-payments-isolated.mjs
node scripts/test-hiring-payments-isolated.mjs --regressions-only
env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
  PLAYWRIGHT_EXECUTABLE_PATH=/repl/tools/bin/chromium \
  node --import tsx --test browser-tests/hiring-payments.browser.test.ts
npx tsc --noEmit
npm run build
```

Preparation failures encountered during development were fixed in the disposable
runner: authoritative SQL-owned financial definitions are used instead of an
incompatible final-state ORM baseline; bundle-relative source assertions retain
their original source location. Production reconciliation guards were not
weakened. The existing separate `admin-auth-check` workflow has an earlier
network-error result; it is not counted as a passed check here.

## 8. Remaining manual UAT

1. Obtain authorized real fee/tax/due terms and transfer instructions. A Super
   Admin must configure these explicitly in the ledger. Test charges in
   disposable fixtures are not production billing policy.
2. Using approved Client/Talent/Super Admin accounts and disposable hiring
   records, perform real browser readiness → reference submission → independent
   settlement review → offer send → response → private document/signatures.
3. Independently check a real approved payment against the actual settlement
   source. Do not attest merely because a Client entered a reference.
4. Confirm real role-specific notifications, navigation, private document access,
   and external email behavior where configured.
5. Review historical unknown-payment and reversal exceptions with the financial
   owner. Do not manufacture historical evidence or automatically mark them paid.
6. Verify downstream recurring billing/payout behavior on approved UAT records;
   no live payout, bank transfer or production billing run was performed here.

## 9. Migration and deployment risks

- Nothing was published; no production schema command or production data change
  was performed. The managed development workflow was restarted normally.
- Use the established migration runner (`predev`/`npm start`) for migration 0038.
  Do not blindly use `db:push`, reset databases or copy fixture records.
- Missing policy intentionally blocks issuance and therefore new formal offers.
  Authorize policy and schedule rollout/UAT before reopening new-offer operations.
- Coordinate all running app instances with the schema release: the database
  trigger also blocks stale app instances that attempt unpaid offer writes.
- Existing sent historical offers can still be accepted/declined; new counters,
  sends or renewals need verified payment. Historical accepted/signed records
  are preserved and flagged for review, not fabricated as paid.
- Existing startup automation still runs through the normal application
  lifecycle. Logs contain legacy non-USD recurring-generation guard warnings;
  this task does not convert/relabel those amounts or remove the guards.
- Manual verification is not a payment gateway. Automated checkout/webhooks
  require a separately authorized real provider integration and signed,
  idempotent settlement verification.
