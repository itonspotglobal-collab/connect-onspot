# Deposit-funded hiring activation

## Prospective flow

1. A Client sends an eligible offer. Existing Talent offer alerts remain.
2. The accepted offer retains its original application. The Client receives an
   editable-template acceptance email and an idempotent bell notification directing
   them to the contract step.
3. The existing private-PDF workflow still requires Talent + OnSpot, plus the
   authorized Client/Organization representative where applicable.
4. The final signature records `contract_signed` and its application history,
   creates the existing security deposit with the unchanged `computeDepositAmount`,
   and issues a deposit invoice identity on that same row. No second debt is created.
   `billing_activated_at` remains null.
5. The deposit-invoice event directs the owning Client to
   `/client/payments/deposit/:id`. The invoice uses approved, protected Wise
   configuration snapshots; no recipient or QR is invented.
6. A reference and private receipt produce `verification_pending`; the deposit
   remains `pending` and the application remains `contract_signed`. Super Admins
   receive review alerts; the Client receives the up-to-24-hours acknowledgement.
7. Rejection records the reason and alerts the Client to resubmit. It never hires.
8. Independent, database-confirmed Super Admin settlement verification sets the
   deposit to `held`, moves the application to `hired` with history, and activates
   billing atomically. Client and Talent activation templates use the accepted
   offer's `proposed_start_date`; onboarding wording is editable template HTML.

All external delivery starts after commit. The durable lifecycle event and
recipient-specific email/bell keys prevent ordinary retry duplication. Provider
acceptance is not a guarantee of inbox delivery. A crash after provider acceptance
but before the local result is persisted requires reconciliation; an ambiguous
`processing` email is not blindly resent.

## Reversible pre-offer gate

`platform_settings.HIRING_PRE_OFFER_PAYMENT_REQUIRED` defaults to false. Both the
shared server guard and database offer trigger read that persisted setting.
False allows offers/counters/renewals without the former invoice; true restores
the prior paid-evidence checks. Existing tables, snapshots, fee policies, invoice
history and settlement evidence remain intact.

- Authenticated read: `GET /api/hiring-payment-settings`.
- Super Admin-only update: `PATCH /api/admin/hiring-payment-settings`, JSON
  `{ "preOfferPaymentRequired": true | false }`.
- Super Admin-only outbox retry: `POST /api/admin/hiring-lifecycle/retry`.

No rate, commission, deposit formula, timesheet or payout calculation is changed.
Private receipt upload/download authorization and independent evidence matching
remain in the existing Manual Wise service.

## Migration

`0043_deposit_funded_activation.sql` is additive/idempotent apart from replacing
the existing status check and offer-trigger function in place:

- Persisted default-off policy.
- New allowed `contract_signed` application status.
- Durable lifecycle event outbox.
- Nullable unique invoice identity on the existing deposit row.

It does not update historical offer/contract/application rows, deposit amounts,
paid evidence or activation timestamps. Existing signed records are never
automatically flipped, charged again or labelled newly verified.

## Historical manual review

A **read-only development** query found **0 signed contracts with no deposit or
without held/applied/forfeited funding**. This is not a production audit.
Production was not queried, migrated or deployed.

Use this read-only review query against the independently identified release
database before rollout; do not treat a legacy staging connection as production:

```sql
SELECT hc.id AS contract_id, hc.submission_id, js.status AS application_status,
       d.id AS deposit_id, d.status AS deposit_status, hc.billing_activated_at
FROM hiring_contracts hc
JOIN job_submissions js ON js.id=hc.submission_id
LEFT JOIN security_deposits d ON d.hiring_contract_id=hc.id
WHERE hc.status='signed'
  AND (d.id IS NULL OR d.status NOT IN ('held','applied','forfeited'))
ORDER BY hc.created_at;
```

## Release checklist

- [ ] Review migration and target identity before any production schema action.
- [ ] Review historical signed/unfunded contracts manually, without rebilling.
- [ ] Confirm approved Wise destination, currency, QR and deposit custody policy.
- [ ] Review/publish the seven new `hiring_*` email templates and onboarding copy.
- [ ] Verify real approved Client/Talent/Super Admin browser sessions separately.
- [ ] Verify real mailbox delivery and CTA login/resource routing separately.
- [ ] Complete populated-state mobile audit; empty/auth-redirect screens are not passes.
- [ ] Reconcile ambiguous provider sends before any manual retry.
- [x] Application build and type check pass.

No real money is required or authorized by the automated fixtures.

## Automated evidence

All business-flow tests below use disposable records and isolated databases or
mocked browser/API/provider transport. They are **not real authenticated-account,
external-mailbox or independent Wise settlement UAT**.

| Check | Result |
|---|---|
| Hiring payment integration, policy off/on incl. counters/renewals and SQL trigger | 16 passed |
| Existing hiring-flow suite | 11 passed |
| Manual Wise integration incl. deposit rejection/resubmission and activation | 23 passed |
| Existing contract-document suite | 15 passed; 1 external-storage case skipped |
| Existing billing/team/hour regressions | 59 passed |
| Email resolver + all default applicant/hiring templates | 13 passed |
| Checkout browser tests, desktop/mobile and all six categories | 9 passed |
| Internal notification URL authorization tests | 2 passed |
| Contract-signed status rendering | 1 passed |
| Populated built-App Talent Profile at 375/390/430px | 3 measurements, no document overflow |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed |

Development preview health returned HTTP 200 after restart. Anonymous reads of
`/api/admin/jobs` and `/api/hiring-payment-settings` returned HTTP 401. The native
unsigned-in screenshot correctly rendered the login dialog rather than bypassing
Client authorization. Its signed-in UI was not verified through that browser.
The existing `admin-auth-check` workflow retained network-error results; that
failed probe is not evidence of missing auth middleware.

The development schema contains the new lifecycle outbox and deposit invoice
identity; the persisted pre-offer flag is false. Production remains untouched.

## Main changed files

- `migrations/0043_deposit_funded_activation.sql`, `shared/schema.ts`,
  `shared/submissionStatuses.ts`: additive schema and status.
- `server/services/hiringPaymentService.ts`, `hiringContractService.ts`,
  `contractDocumentService.ts`, `manualWiseService.ts`: policy/signing/funding
  transitions; private receipt and QR authority preserved.
- New `server/services/hiringLifecycleEvents.ts` and
  `hiringLifecycleDispatch.ts`, plus `server/routes.ts`: transactional events,
  post-commit deliveries and guarded policy/retry routes.
- `server/seeds/seedEmailTemplates.ts`, `emailVariableResolver.ts`: seven new
  editable defaults and supported rendering variables.
- New `client/src/pages/client/ClientPaymentPage.tsx`,
  `ManualWisePaymentPanel.tsx`, and existing invoice/Billing/inquiry/hiring
  entrypoints: shared incoming checkout, retaining canonical financial values.
- Notification routing/Bell, application status maps, Client/Talent application
  pages, applicant email composer and Admin application/detail surfaces:
  role-safe links, reversible offer gate and visible `contract_signed` stage.
- `client/src/pages/TalentProfile.tsx` and profile rich-text styles:
  constrained layout and long-text wrapping, without page-wide overflow hiding.
- Isolated server fixtures, `scripts/test-hiring-payments-isolated.mjs` and
  `browser-tests/*`: integration/regression and browser evidence.

## Mobile audit qualification

See `docs/mobile-profile-populated-audit.md` for the reproducible 766px failure,
its root-cause fix and exact after measurements. The full-route sweep is a
separate audit: unrepresentative, redirected, runtime-error and missing-content
states must not be reported as populated-screen passes.

The corrected pre-fix wide sweep collected **417 measurements/screenshots across
139 routes**: 138 rendered, 267 had fixture/runtime errors and 12 redirected.
It exposed 17 overflowing states across seven additional routes. After fixing
those root causes, a focused rerun of all seven plus Talent Profile passed
**24/24** route/viewport checks. See the populated audit document for the exact
before widths and fixes. The ongoing full-sweep test rejects incomplete coverage.
The original all-routes mobile completion requirement remains **not signed off**:
representative data and fixture/runtime failures must still be resolved.

The final post-fix repeat again visited all **139 routes / 417 viewports**:
**138 rendered checks had no observed horizontal overflow**; 262 had
fixture/runtime errors, 15 redirected and 2 lacked page content. The coverage
gate correctly **failed**, because those 279 states are unverified—not passes.
The new template categories/variable-reference UI was subsequently checked at
all three widths with no overflow. All seven new templates are present as
published defaults in the development database.
