# Per-application hiring payment skips

## Step 0 findings (2026-10-29, before implementation)

The persisted setting `HIRING_PRE_OFFER_PAYMENT_REQUIRED` was **false** in both environments.

| Environment | Recorded update time (UTC) | Last actor |
|---|---|---|
| Development | 2026-10-27 08:24:09.210960 | Not recorded |
| Production, SELECT-only | 2026-10-27 10:12:03.524623 | Not recorded |

The settings row has no actor column, and the previous settings PATCH handler did not audit changes. These timestamps do not prove who changed the setting or that its value changed rather than being rewritten.

Existing enforcement:

- `server/services/hiringPaymentService.ts`: `requireVerifiedHiringPayment`.
- `server/routes.ts`: initial Client/Super-Admin-on-behalf offer creation and both Client/Talent counter writers.
- `server/services/offerExpirationService.ts`: renewal.
- `enforce_hiring_pre_offer_payment`: PostgreSQL offer INSERT/UPDATE trigger, previously defined by migrations 0038/0043.
- `client/src/pages/ClientProfile.tsx`: payment-settings, verified-invoice and offer-button gating.

Only a database-confirmed Super Admin can use the shared offer writer on a Client's behalf. Scoped Admins do not gain that permission through this feature.

## Behavior and boundaries

- A Super Admin (`users.role='admin'`, `admin_sub_role IS NULL`) can grant a **defer** or **waive** exception with a reason of 10–2000 characters.
- Active exceptions match the original submission, Client, job and Talent. Neither another application's exception nor a mismatched identity authorizes an offer.
- Submission-row locking precedes waiver locking in service and trigger enforcement.
- Defer permits offers/counters/renewal, then locks at acceptance. An Admin must explicitly issue the hiring invoice using the existing fee-policy calculation and configuration. Deposit issuance remains automatic and unchanged. Contractor Agreement preparation/sending and this application's MSA request wait for both independently verified payments.
- Waive creates no hiring invoice. The independently verified security deposit, Contractor Agreement and current Client MSA remain required.
- Locked arrangements cannot be revoked or changed. Pre-acceptance revocation leaves a previously sent offer intact but blocks unpaid counters/renewals when the global policy is ON.
- Client requests notify Super Admins but do not change eligibility, verification or settlement.
- The global setting is not changed by grant/request/revoke. Global setting changes now use the existing financial Admin audit ledger atomically with the setting update.
- Talent responses do not expose the arrangement or internal reason.
- Existing financial obligations are never silently erased. If an active hiring invoice already exists, granting a new skip returns an explicit review-required conflict; review/void that obligation through the authorized financial workflow first.

### Policy at acceptance

`deferred_payment_required` captures whether a defer exception actually deferred a required payment when the offer was accepted. This prevents a new acceptance while the global policy is OFF from acquiring a new hiring-fee debt solely because an old waiver exists. A debt already deferred at acceptance remains due even if the global setting is subsequently disabled.

### Reminders and delivery

Acceptance creates a durable `hiring_deferred_due` event in the same transaction as the deposit. It is delivered after COMMIT.

The existing background-jobs switch controls a 15-minute waiver-outbox poll. The poll is restricted to the new skip/deferred events; it does not start retrying unrelated historical email backlogs. Once two business days have elapsed without invoice issuance, reminders use one event key per waiver/UTC date. Business days currently mean **Monday–Friday in UTC**, preserving the acceptance time of day, with no invented holiday calendar. An environment with background jobs disabled must enable the approved worker before automatic reminders can run.

New editable templates:

1. Payment Skip Requested → Super Admins.
2. Payment Skip Granted → owning Client.
3. Payment Skip Revoked → owning Client.
4. Deferred Hiring Invoice Due → Super Admins.
5. Deferred Hiring Invoice Reminder → Super Admins.
6. Deferred Hiring Invoice Issued → owning Client.

Bell and email delivery use the existing recipient-specific durable event keys. Provider/configuration failures retain retryable events; they never roll back a committed offer or fabricate delivery success.

## Migration and development verification

`migrations/0046_hiring_payment_waivers.sql` adds the waiver table, foreign keys, reason/type checks, one-active-waiver partial unique index and replaces the existing trigger function with waiver-aware enforcement. It does not edit 0038/0043, remove payment verification, change the global setting, rewrite invoices/deposits or drop data-bearing objects.

The migration was reapplied in the disposable PostgreSQL Manual Wise suite. Development was updated through the normal application workflow. Post-restart development checks confirmed:

- waiver table exists;
- offer trigger function includes waiver enforcement;
- global payment setting remains false;
- existing deposit row count remains two;
- anonymous waiver-status API access returns HTTP 401;
- exactly one application listener owns the preview port.

No production migration, financial mutation or publishing was performed.

## Verification performed

| Check | Result |
|---|---|
| Hiring payments, native PostgreSQL | 16 passed |
| Contractor onboarding including new waiver cases, native PostgreSQL | 17 passed |
| Hiring flow, native PostgreSQL | 11 passed |
| Manual Wise, native PostgreSQL | 23 passed |
| Private contract documents | 15 passed; 1 optional external-storage roundtrip skipped |
| Payment verification controls, isolated React rendering | 4 passed |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed |
| `git diff --check` | Passed |

The new PostgreSQL cases cover unpaid route/trigger rejection, both skip types, initial offers/both counters/renewal, acceptance locks, deferred invoice idempotency, proof versus settlement, deposit-plus-fee gating, activation conditions, Client request deduplication, role denial, identity mismatches, revocation/send ordering, global-OFF acceptance and business-day reminder deduplication.

When send commits before revoke, both operations may legitimately succeed: the sent offer stays and future unpaid counters fail. When revoke commits first, the send fails. This is the specified linearized behavior, not a promise that only one operation can ever commit.

All account identities and settlement evidence in the fixtures were synthetic and confined to owned disposable PostgreSQL. Some terminal agreement states were set directly in the new gate tests; the separate private-document suite exercises actual signing logic. Blob transport in onboarding fixtures is an in-memory double. These results are **not real authenticated-account, external-storage or independent Wise verification UAT**. The preview screenshot showed the intact staff-login screen; the signed-in Admin/Client UI and real inbox delivery were not verified.

## Short UAT script

Use approved Client, Talent and Super Admin test accounts in isolated staging, a real approved test job, a passed completed Final interview, an authorized fee policy and approved payment configuration. Do not invent receiving details or mark fabricated receipts as independently verified in production. Positive no-money settlement checks require explicitly approved staging-only synthetic fixtures.

### Defer → offer → acceptance → hiring invoice → agreements → Active

1. Super Admin enables the pre-offer payment policy in Admin Settings and confirms. Verify the audit record. Without payment or an exception, the Client cannot send an offer.
2. Client requests a skip with a written message. Verify Super Admin bell/email; no eligibility changes yet.
3. Super Admin opens application detail, chooses **Skip payment verification → Defer**, writes the reason and confirms. Verify same-status history, financial Admin audit and Client grant bell/email.
4. Client sees **Send Offer** and the deferred-until-acceptance note. Send an offer; test both counter directions and an explicit renewal. Existing final-interview rules still apply.
5. Talent accepts. Verify the waiver is locked, the unchanged security-deposit invoice is issued, and Super Admins receive **send the deferred hiring invoice** with the application link. No agreement is issued.
6. Super Admin uses **Send deferred hiring invoice** on the onboarding/payment card. Verify the authorized policy amount, invoice link on the waiver, Client invoice bell/email and duplicate-click idempotency. Client/Talent/scoped Admin calls must return 403.
7. Client submits proof through the existing secure Manual Wise checkout. Verify proof alone never unlocks agreements. Reject/resubmit if desired; perform genuine independent verification, or an explicitly approved isolated synthetic settlement.
8. Verify only one payment is insufficient: a held deposit with an unpaid hiring invoice remains blocked, and a verified hiring invoice without a held deposit remains blocked.
9. After both are verified, verify the private Contractor Agreement draft and current Client MSA request. Talent and OnSpot sign the Contractor Agreement; Client signs the current MSA (or its already-valid signature is reused). No partial state activates.
10. Verify one Active transition and the normal Client/Talent Active emails. Talent must never see Client payment arrangements.
11. On a separate accepted defer test record, leave the hiring invoice unissued. After two UTC business days verify one reminder per day, no duplicate on retries, and no further reminder after issuance. Do not change real production timestamps to accelerate this.

### Waive → offer → acceptance → deposit → agreements → Active

1. On a second application, Super Admin grants **Waive**, with reason and optional arrangement note. Verify Client special-arrangement note and grant notification.
2. Send and accept the offer. Verify locked waiver and ordinary security-deposit invoice; **no hiring invoice** and no deferred-invoice task.
3. Submit/independently verify the deposit through the existing Manual Wise process. Proof alone remains insufficient.
4. Verify normal private Contractor Agreement/MSA preparation, required signatures, one Active transition and the normal Active emails.
5. On another unaccepted test application, revoke a skip with a reason. Verify Client notification, preserved existing sent offer, and restored payment checks on new counters/renewal. After acceptance, revoke must return a locked-arrangement conflict.
6. Verify Client/Talent/scoped Admins cannot grant/revoke/change global policy. Recheck an unrelated application with no waiver and the global-OFF path.

## Files changed

- Schema/migration: `migrations/0046_hiring_payment_waivers.sql`, `shared/schema.ts`.
- Waiver API/service: `server/routes/hiringPaymentWaivers.ts`, `server/services/hiringPaymentWaiverService.ts`.
- Payment/acceptance/agreement/activation: `server/services/hiringPaymentService.ts`, `server/services/hiringPaymentErrors.ts`, `server/services/contractorOnboardingPolicy.ts`, `server/services/paidAgreementService.ts`, `server/services/manualWiseService.ts`, `server/services/hiringLifecycleEvents.ts`.
- API wiring/settings audit: `server/routes.ts`.
- Delivery/reminders/templates: `server/services/hiringLifecycleDispatch.ts`, `server/index.ts`, `server/seeds/seedEmailTemplates.ts`, `client/src/pages/AdminEmailTemplates.tsx`.
- UI: `client/src/components/hiring-payments/PaymentVerificationCard.tsx`, `client/src/components/hiring-payments/HiringPaymentPolicyToggle.tsx`, `client/src/pages/AdminJobApplications.tsx`, `client/src/pages/AdminContractorOnboarding.tsx`, `client/src/pages/AdminSettings.tsx`, `client/src/pages/ClientProfile.tsx`.
- Tests/harness: `server/tests/contractor-onboarding.fixture.ts`, `server/tests/hiring-payments.fixture.ts`, `server/tests/manual-wise.integration.test.ts`, `scripts/test-hiring-payments-isolated.mjs`, `client/src/components/hiring-payments/PaymentVerificationCard.test.tsx`.
- This report and project policy memory.
