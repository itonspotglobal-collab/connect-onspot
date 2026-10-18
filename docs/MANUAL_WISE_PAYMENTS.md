# Manual Wise payment and receipt verification

## Scope and operating rules

Wise transfers happen outside OnSpot. There is no Wise API, gateway, automatic money movement, fabricated destination, default bank account, or seeded QR. Receipt submission means **Pending Verification**, not Paid or Disbursed. Only a current Super Admin (`admin` with `admin_sub_role IS NULL`, checked from the database) can confirm independently settled funds.

The existing financial rows remain the source of balances, owners and business lifecycle. `manual_wise_obligations` only binds one existing row to immutable instructions; it is not a second invoice or an additional debt. Submission amounts are evidence snapshots, not ledger balances.

### Covered obligations

| Category | Existing authority | On proof submission | On independent verification |
|---|---|---|---|
| `inquiry` | Admin-finalized `inquiries.payment_amount`, currency | Inquiry payment status pending verification; never use estimated budget as the fee | Existing inquiry becomes paid/verified |
| `hiring_invoice` | Issued pre-offer invoice | Verification pending; existing offer gate remains locked | Existing paid/evidence columns and payment event updated; unchanged offer gate can pass |
| `invoice` | Existing legacy client invoice | Sent/overdue stays unpaid | Existing invoice becomes paid, reference retained |
| `monthly_invoice` | Sent monthly statement subtotal minus applied credits | Statement remains unpaid | Separate settlement status becomes paid; issuance status stays sent |
| `deposit` | Existing deposit principal and signed-contract owner | Deposit stays pending; no payout coverage | Existing deposit becomes held |
| `replenishment` | Explicit finalized top-up request | Funding remains unpaid; excluded from coverage | Top-up becomes settled coverage; a permitted suspended-deposit cure returns to held |
| `payout` | Existing scheduled/pending payout and linked talent invoice/legacy period | Outgoing evidence pending; payout stays pending/scheduled | Existing payout becomes disbursed after coverage and identity checks |

Existing commissions, rates, Tracked/Guaranteed calculations, timesheets, semimonthly periods, monthly grouping, credits, deposit principal formula, termination calculations and scheduling dates are unchanged. New pending replenishments do not count as coverage; historical replenishments retain their existing settled interpretation.

Incoming fees and outgoing payouts are separate. Payouts never show an incoming collection QR. An immutable, independently approved payout destination must be recorded first. A sent modern talent invoice requires held deposit coverage including settled top-ups and existing payout reservations. A legacy payout still requires the linked paid legacy invoice.

## Configuration and QR setup

1. Sign in as Super Admin and open **Admin Ledger → Manual Wise payments**.
2. Enter an approved recipient, currency, transfer instructions and reference instructions. Do not copy account details from an unapproved document.
3. Optionally upload the actual approved QR image, then save its returned file with the configuration. PNG, JPEG and WebP are supported; PDF is not a QR format.
4. Mark the configuration active for the currency. Only one active version per currency is allowed.
5. Confirm the manual deposit-funding operating/custody policy separately **only after business approval**. Without this flag, deposit and top-up receipt submission/settlement remain disabled.

Configuration versions are retained. Existing obligations retain their previously displayed recipient/instructions; editing settings never silently redirects an invoice already shown to a payer. A later active version applies to newly enrolled obligations. Deactivating the last active version pauses incoming collection for that currency. Deposit policy authorization uses the current active version, not an old instruction snapshot. Hiring instructions must exactly match the pre-offer invoice's immutable recipient; a mismatch needs financial review, not a silent rewrite.

The customer sees **“QR code not configured”** when no QR exists. Written approved instructions can still be used. Missing configuration or a missing finalized amount disables proof submission. No zero amount is invented.

## Secure storage and access

New receipts and QR images use existing private App Storage under the configured private object directory, with randomized `manual-wise` object identifiers. The database retains file metadata, not public URLs or inline file contents. Storage configuration is a deployment prerequisite.

Uploads require a transfer reference and a receipt. The server inspects content independently of filename or MIME header, accepts PNG/JPEG/WebP/passive PDF, limits each upload to 8 MiB, and rejects active PDF content. Protected downloads require a database-derived owner or Super Admin; responses use attachment disposition, no-store, nosniff and a sandbox policy. Generic object routes cannot retrieve the `manual-wise` namespace. No receipt contents or storage credentials are logged.

Old `/payment-proofs/*` public URLs are denied. Historical files are not deleted or automatically relabeled as new verified receipts. Super Admin can download a locally available historical inquiry receipt through the authenticated archival endpoint; files missing from the deployed filesystem, oversized or unsafe files require controlled archival review. New production operation does **not** depend on local receipt storage. Historical files must be migrated separately to durable private storage if archival availability is required.

An upload that loses a submission race can leave an unlinked private metadata/blob record. It is not downloadable by another customer and creates no credit; retained evidence should only be cleaned under an approved retention policy.

## API

All new endpoints require the application's existing bearer authentication. No owner or administrator ID is accepted from the request body. Role and ownership are rechecked in the database.

Customer/owner:

- `GET /api/manual-wise/obligations`
- `GET /api/manual-wise/obligations/:category/:id`
- `POST /api/manual-wise/obligations/:category/:id/proofs` — multipart `reference` and `receipt`
- `GET /api/manual-wise/files/:id` — authenticated bytes, never an unrestricted file URL

Super Admin:

- `GET /api/admin/manual-wise/submissions` — filters: category, status, currency, payer, reference, from, to
- `POST /api/admin/manual-wise/submissions/:id/review` — reject with reason, or verify with independent confirmation, amount, currency, recipient, actual transaction reference, settlement date and reason
- `GET /api/admin/manual-wise/config`
- `POST /api/admin/manual-wise/config` — new version, not a rewrite of existing instructions
- `POST /api/admin/manual-wise/config/qr` — multipart image `receipt`
- `GET /api/admin/manual-wise/payouts`
- `POST /api/admin/manual-wise/payouts/:id/destination` — approved recipient, reason, explicit independent approval
- `POST /api/admin/manual-wise/inquiries/:id/quote` — positive finalized amount/currency before any submitted proof
- `GET /api/admin/manual-wise/legacy-inquiries/:id/receipt`

Existing integrations modified:

- `POST /api/admin/contracts/:hcId/security-deposit` creates/returns a **pending funding request**, never directly marks it held. Restricted to Super Admin.
- `POST /api/admin/security-deposits/:id/replenishments` creates an **unpaid** funding request; restricted to Super Admin. A suspended cure must restore the existing principal exactly; partial cure requires financial review.
- Monthly invoice reads include separate `payment_status` and `paid_at`.
- Inquiry detail requires a uniquely matched authenticated client with server-verified matching email, or Super Admin. Knowing the inquiry UUID or email is not authorization. Inquiry list and administrative lifecycle changes require Super Admin.
- Reference-only hiring submission/verification, old inquiry verification/payment routes and direct invoice-paid/payout-disbursed/deposit-held/cure shortcuts return conflict responses directing callers to the shared evidence workflow. Existing non-settlement lifecycle operations remain available. The retired inquiry Stripe-payment endpoint cannot initiate a gateway payment.
- Completing an inquiry requires already verified payment. Uploading evidence or changing lifecycle status cannot bypass settlement.

## Audit, duplicate prevention and corrections

Verification locks canonical records and evidence, and writes the ledger transition and audit event in one transaction. One pending/paid attempt per obligation prevents duplicate credits; a rejected attempt remains immutable history and permits a new receipt. Settled references are normalized for duplicate checks across shared evidence and historical invoice/inquiry/payout/hiring records. Concurrent verifications are serialized; exact retries are idempotent.

Full amount, currency and approved destination must match. A receipt alone or a reference alone cannot pass verification. Future settlement dates are rejected. Status changes after submission, insufficient payout coverage, changed balances and closed deposit contracts fail closed.

Partial payments, overpayments, currency conversions, allocating one transfer across multiple obligations, automated refunds/chargebacks and automatic archival backfill are **not supported** by this workflow. There is no pre-existing allocation ledger for these cases; allowing them would redesign billing. They require explicit financial review/reissue through the existing business process rather than fabricated matching amounts. Existing void/refund/invalidation history remains intact and is shown separately from historical verified evidence.

## Migration and release

`migrations/0040_manual_wise_payments.sql` depends on the existing inquiry, pre-offer payment, invoice, monthly statement, deposit/replenishment, payout, contract and user tables. It adds shared evidence/config/audit tables plus independent monthly/top-up settlement fields. It does not drop or rename columns, rewrite paid invoice history, seed accounts, mark historical unpaid invoices paid or weaken the existing offer-payment trigger.

- Owned disposable PostgreSQL: executed twice to verify additive/idempotent application and tested against the real migration.
- Development database: applied and verified on 2026-10-18. The migration ledger contains `0040_manual_wise_payments`; all five shared tables exist. Configuration count is zero: no payment destination or QR was invented.
- Production: **not applied or verified by this task**. Do not run schema push/reset or a destructive synchronization.

Before publishing, confirm the target migration history and make an approved backup; apply the additive migration using the existing `npm run migrate`/startup migration path. Verify migration registration and object storage access in that environment. No production migration should be applied while the database identity or migration state is uncertain. The existing publish startup runs migrations before serving.

For rollback, pause collection and preserve all evidence and audit rows. Do not drop the new tables or restore old public receipt access to roll back UI code.

## Manual acceptance checklist

Use approved test accounts and disposable obligations; never create fake settlement records for real money.

1. Configure an approved test recipient without a QR; confirm the safe placeholder on desktop and a narrow phone.
2. Client opens their own inquiry with a finalized quote. Upload a receipt and reference. Confirm pending verification, not paid.
3. Repeat for an issued hiring invoice; offer creation must remain locked.
4. Super Admin opens the queue, views the protected receipt and checks actual external settlement independently. Confirm exact amount/currency/recipient/reference/date, enter a reason and verify. Confirm the existing hiring gate now passes.
5. Test monthly net-after-credit and legacy invoice payment. Neither changes balance/status before verification.
6. Request initial deposit funding; confirm pending has no coverage. Approve the operating policy, submit and verify actual funds; only then held coverage is usable.
7. Create a held-deposit top-up or a full-principal suspended cure. Confirm pending top-up does not add coverage; independent settlement does.
8. Reject proof with a clear reason. Client sees the reason and can submit corrected evidence; old evidence remains visible.
9. Attempt another client's invoice/receipt, anonymous download, client verification and scoped-admin verification: all denied. Old public receipt URL must also fail.
10. Try mismatched amount/currency/recipient, reused settled reference, two simultaneous admin verifications and an exact retry. Confirm no duplicate credit or contradictory state.
11. Approve a real test payout destination, attach transfer evidence and confirm payout remains scheduled. Independently verify a real test transfer; only then disbursed. No incoming QR appears.
12. Recheck paid history, void/refund/invalidation display and normal non-settlement deposit lifecycle controls.

## Automated verification

- `npx tsc --noEmit`
- `npm run build`
- `npx tsx --test --test-concurrency=1 server/tests/manual-wise.integration.test.ts`
- `npx tsx --test --test-concurrency=1 browser-tests/manual-wise.browser.test.ts`
- `npx tsx --test server/tests/talent-invoice-calculations.test.ts`

The new server suite owns and deletes a private local PostgreSQL cluster and injects an isolated blob transport. It exercises actual SQL migration, service and HTTP multipart/download paths without touching application/production records. Browser fixtures render the actual components against isolated API responses, not an authentication bypass in the application. These tests do not verify a live Wise transfer, real production credentials, production storage read/write or signed-in production UAT.

## Exact implementation files

- `migrations/0040_manual_wise_payments.sql`
- `shared/schema.ts`
- `server/services/manualWiseService.ts`
- `server/services/manualWiseFiles.ts`
- `server/routes/manualWise.ts`
- `server/routes.ts`
- `server/routes/talentInvoices.ts`
- `server/objectStorage.ts`
- `client/src/components/manual-wise/ManualWisePaymentPanel.tsx`
- `client/src/components/manual-wise/AdminWisePayments.tsx`
- `client/src/components/hiring-payments/ClientHiringPayments.tsx`
- `client/src/components/hiring-payments/AdminHiringPayments.tsx`
- `client/src/pages/InquiryPayment.tsx`
- `client/src/pages/InquirySuccess.tsx`
- `client/src/pages/AdminInquiries.tsx`
- `client/src/pages/AdminLedger.tsx`
- `client/src/pages/client/Billing.tsx`
- `server/tests/manual-wise.integration.test.ts`
- `browser-tests/manual-wise.browser.test.ts`
- `docs/MANUAL_WISE_PAYMENTS.md`

Project memory updates: `.agents/memory/MEMORY.md`, `.agents/memory/billing-engine.md`, `.agents/memory/manual-wise-settlement-policy.md`.

### Verified result and remaining operational checks

On 2026-10-18: TypeScript passed; all production build stages passed; 20 backend/billing calculation tests passed; all five browser tests passed at desktop and narrow-phone sizes. The running development app returned 401 for anonymous customer/admin payment reads and inquiry list, and 403 for old public receipt URLs. A mobile app screenshot confirmed the inquiry owner-sign-in state, without bypassing authentication.

The signed-in application pages were tested as isolated component fixtures, not as authenticated production UAT. Actual Wise settlement, production private storage, production migration application and real approved-account financial UAT remain unverified. Do these before enabling real collection.

Existing unrelated diagnostics remain: the separate admin-auth-check workflow reports network fetch failures, and the public preview logs an invalid Lindy embed authorization and a missing Stripe public key. The new manual workflow does not depend on Lindy or Stripe. Existing Browserslist/PostCSS/chunk-size build warnings do not fail the build.
