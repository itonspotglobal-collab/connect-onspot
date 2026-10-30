# Hiring, Investors and Super Admin changes

## Delivery status

Implemented in development; not published. No production migration or production data change was performed.

Normal hiring has no pre-offer payment gate. Fresh acceptance creates a deposit; agreements and activation still require payment unless a database-confirmed Super Admin records an explicit audited exception. A waiver is never labelled Paid and never creates cash, proof, verification references or signatures.

### Verification

| Check | Actual result |
|---|---|
| `npm run check` | Passed after each implementation part |
| Production build | Passed |
| Owned PostgreSQL interview/workflow fixture | 5 passed |
| Owned PostgreSQL + HTTP override fixture | 5 passed; every new endpoint denied Clients, Talent, TA and Client Success |
| Owned PostgreSQL email/outbox fixture | 2 passed; provider mocked, no external delivery claim |
| Investor settings server tests | 7 passed |
| Investor isolated browser suite | All 27 cases passed across the final full run plus a targeted rerun: 26 passed together, then the corrected founder-title selector/direct-refresh case passed separately. Includes opaque phone-pixel bounds across responsive widths. |
| Live anonymous Admin-route checks | All 12 existing Admin jobs endpoints reject with 401; the new override capability endpoint also returns 401 anonymously. |
| Full `npm test` | Invoked after each part; blocked by the new disposable-database safety guard, not a passing full suite |
| Real authenticated Client/Talent/Super Admin UAT | Not performed; synthetic fixture identities are not approved real accounts |
| External email receipt/login/deep-link UAT | Not performed |
| Migration preservation | New override migration applied twice against an owned fixture with deposit financial rows unchanged |

The full server runner previously launched migrations and mutative fixtures against whichever database the shell inherited. It now fails before doing so unless explicitly pointed at an owned disposable database. Do not set its opt-in flag on a shared development or production database.

## New settings and schema

* `HIRING_PRE_OFFER_PAYMENT_REQUIRED`: permanently false. The API cannot re-enable it, and a stale true setting no longer gates offers.
* `investor_goal_total`: positive integer goal, default `10000`; public read, Super Admin write.
* `deposit_reminder_hours`: positive comma-separated integer hours, default `48,120`; Super Admin write.
* New table `admin_hiring_overrides`: `id`, `actor_id`, `submission_id`, `client_id`, `talent_id`, `action`, `previous_state`, `new_state`, `reason`, `notify_parties`, `created_at`, `reverted_at`, `reverted_by`.
* `job_submissions.admin_direct_placement`: boolean, default false.
* `security_deposits`: new `waived` status and `waived_by`, `waived_at`, `waiver_reason`.
* `hiring_contracts.activation_override_id`: links exceptional activation to its audit without pretending an unsigned contract was signed.
* `manual_wise_obligations.cancelled_at`, `cancellation_reason`: stops collection/review of waived obligations while retaining receipts.
* New published template categories: `hiring_deposit_required`, `hiring_deposit_reminder`, `hiring_admin_override`, `hiring_agreements_waived`. Dedicated acceptance and Talent confirmation remain separate; the old combined acceptance/invoice template is not selected for sending.

Migrations: `0049` retires the fee setting/trigger; `0050` seeds reminders; `0051` adds overrides/waivers. These use the existing versioned migration runner rather than adding startup-only DDL that would miss production. Existing tables and financial records are not dropped.

## Important boundaries and remaining checks

* Actual held-cash coverage and payout guards remain strict. A waived onboarding requirement is not money available to pay Talent.
* Original accepted deferred hiring obligations are preserved as payable obligations; ordinary retired pre-offer invoices are read-only. No historical debt was silently erased.
* Safe automatic reversal is deliberately narrow: an early-stage override with no downstream hiring activity can be reverted. Financial/agreement/activated changes return an explanation instead of deleting history.
* Direct placements explicitly bypass agreement requirements; their confirmation says so. If deposit is required they remain pending until actual settlement or a separate audited waiver.
* Optional override notifications are separate from normal transactional invoice/activation notifications. Normal transactional events remain eligible for delivery.
* Existing editable/custom email templates are not overwritten.
* Mark Apostol needs a verified real portrait. The existing `public/mark-apostol.png` is not sufficient evidence of a verified founder photo; the page uses initials rather than stock/AI imagery. See `docs/investors-image-audit.md`.
* Fixed the live phone clipping caused by an entrance animation overriding its positioning transform. The replacement fade preserves the original full transparent PNG and its responsive offsets.
* A live page render is not authenticated workflow verification. Complete staging UAT with approved accounts before publishing these privileged actions.
* The development startup logs reported existing PHP-source billing records being correctly blocked from new USD invoicing. They were not converted or altered by this work.
* The unrelated Lindy embed reported an invalid authorization query parameter in the browser; this was not changed.

## File-by-file change list

### Frontend

| File | Change |
|---|---|
| `client/src/components/ContractorOnboarding.tsx` | Deposit-required card; waived state; overridden-stage badges. |
| `client/src/components/PendingDeposits.tsx` | New Client-home deposit banner with amount, currency and payment link. |
| `client/src/components/InvestorGoalSettings.tsx` | Super Admin total-goal editing and validation feedback. |
| `client/src/components/admin-hiring-overrides/OverrideControls.tsx` | Super Admin capability check, confirmed actions, reasons, notifications, history/revert, waiver controls, direct-placement dialog. |
| `client/src/components/hiring-payments/AdminHiringPayments.tsx` | Hide mutative actions for read-only historical pre-offer invoices. |
| `client/src/components/hiring-payments/ClientHiringPayments.tsx` | Retire pre-offer panel and show historical section only when records exist. |
| `client/src/components/hiring-payments/HiringPaymentPolicyToggle.tsx` | Remove the re-enable toggle. |
| `client/src/components/hiring-payments/paymentTypes.tsx` | Read-only historical invoice metadata. |
| `client/src/components/manual-wise/AdminWisePayments.tsx` | Audited deposit waiver entry point. |
| `client/src/components/manual-wise/ManualWisePaymentPanel.tsx` | Explicit Waived label, never independently verified. |
| `client/src/pages/AdminClientDetail.tsx` | Add Talent directly action. |
| `client/src/pages/AdminJobApplications.tsx` | Application override card/history, using persisted permissions. |
| `client/src/pages/AdminLedger.tsx` | Waiver actions on pending deposits. |
| `client/src/pages/ClientProfile.tsx` | Remove pre-offer polling/payment button conditions; use stage blockers. |
| `client/src/pages/ClientTeamDashboard.tsx` | Mount home deposit banner. |
| `client/src/pages/InvestorsCorner.tsx` | Headline highlights, original phone asset presentation, total-account meter, founder image safeguards. |
| `client/src/pages/InvestorsCorner.css` | Responsive phone/headline/progress layout and reduced-motion handling. |
| `client/src/pages/client/ClientPaymentPage.tsx` | Waived lifecycle label. |

### Backend and shared schema

| File | Change |
|---|---|
| `server/index.ts` | Existing scheduled lifecycle sweep also dispatches deposit reminders. |
| `server/routes.ts` | Retired policy API, reminder setting permission/validation, override registration and explicit exceptional-contract eligibility. |
| `server/lib/clientTeamDashboardHandler.ts` | Direct placements in authorized Team results; preserve name-reveal threshold, no email-as-name fallback. |
| `server/routes/adminHiringOverrides.ts` | New guarded/rate-limited action, capability and history routes. |
| `server/routes/clock.ts` | Explicitly activated audited placements can clock in; unsigned ordinary contracts cannot. |
| `server/routes/contractTerminations.ts` | Termination eligibility for properly activated audited placements. |
| `server/routes/contractorOnboarding.ts` | Owned Client pending-deposit API. |
| `server/routes/investorGoals.ts` | Seed and expose total goal. |
| `server/routes/talentInvoices.ts` | Billing eligibility for audited active placements without fabricated signatures. |
| `server/seeds/seedEmailTemplates.ts` | Separate acceptance, invoice, reminder and truthful override/waiver templates. |
| `server/services/adminHiringOverrideService.ts` | Transactional Super Admin actions, real offer/deposit records, safe reversal, audit/history and activation. |
| `server/services/adminHiringOverrideState.ts` | Read active audit flags without inferring interview/signature evidence. |
| `server/services/clientMsaService.ts` | Waived-deposit rechecks for otherwise eligible agreements. |
| `server/services/contractorOnboardingPolicy.ts` | Explicit stage exception recognition and held-or-waived agreement eligibility. |
| `server/services/contractorOnboardingStatus.ts` | Pre-acceptance stage blockers versus later financial/legal blockers; explicit waiver/bypass states. |
| `server/services/depositReminders.ts` | Validated schedule and idempotent pending-deposit reminder enqueueing. |
| `server/services/emailVariableResolver.ts` | Due-date/deposit-link variables and URL safety. |
| `server/services/hiringLifecycleDispatch.ts` | Separate emails, reminder stale-state checks, masked names and truthful waiver/override messaging. |
| `server/services/hiringLifecycleEvents.ts` | Override event and activation with audited, explicit legal/payment exceptions. |
| `server/services/hiringPaymentService.ts` | Permanent pre-offer retirement and read-only historical invoices, preserving accepted deferred debts. |
| `server/services/manualWiseService.ts` | Cancelled/waived obligation enforcement; no payment destination or settlement claim for waived deposits. |
| `server/services/paidAgreementService.ts` | Waivers satisfy only payment eligibility; respect explicit MSA bypass. |
| `server/services/timesheetEligibility.ts` | Central eligibility for normal signed contracts versus audited activated exceptions. |
| `shared/investorGoals.ts` | Total-goal setting and validation. |
| `shared/schema.ts` | New audit table, waiver/cancellation/placement/activation fields and status constraints. |

### Migrations, verification and documentation

| File | Change |
|---|---|
| `migrations/0049_retire_pre_offer_payment.sql` | Disable fee setting and stale fee trigger, retaining offer identity immutability. |
| `migrations/0050_deposit_reminders.sql` | Insert-if-absent reminder schedule. |
| `migrations/0051_admin_hiring_overrides.sql` | Additive audit/waiver fields; broaden deposit status constraint without dropping rows. |
| `scripts/run-server-tests.ts` | Refuse accidental mutative full-suite runs against shared databases. |
| `scripts/test-hiring-payments-isolated.mjs` | Owned database modes for workflow, notification and override fixtures; include new migrations. |
| `scripts/verify-admin-auth.ts` | Reach the configured development proxy instead of failing on localhost resolution. |
| `server/tests/admin-hiring-overrides.fixture.ts` | Real PostgreSQL and HTTP/service authorization, audit, waiver, placement and migration-preservation tests. |
| `server/tests/deposit-notifications.fixture.ts` | Actual dispatcher logic with fake provider: idempotent acceptance/invoice emails and scheduled reminder suppression. |
| `server/tests/interview-workflow.fixture.ts` | No-payment interview/offer, fresh-acceptance deposit coverage. |
| `server/tests/investor-goals.test.ts` | Total-goal response, validation and role restrictions. |
| `browser-tests/investor-documents.browser.test.ts` | New goal/meter states and responsive phone/headline assertions. |
| `docs/investors-image-audit.md` | Existing asset inspection and verified-founder-photo limitation. |
| `docs/hiring-investor-change-report.md` | This delivery, schema, file and verification report. |
| `.agents/memory/pre-offer-payment-policy.md` | Updated durable owner-authorized fee/override policy. |
| `.agents/memory/MEMORY.md` | Updated pointer to that policy. |
