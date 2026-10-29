# Interview and offer workflow recovery

Date: 2026-10-29. Production was inspected read-only. Nothing was published and no production migration or data update was performed.

## Step 0: evidence collected before implementation

### Production logs

The inspected seven-day window ended approximately 2026-10-29 09:16 UTC. One observed matching failure was:

- 2026-10-26 12:05:26.769 UTC: `PATCH /api/talent/interviews/:id/respond`, HTTP 502, 1182 ms.
- No exact matches for the requested business/calendar error codes were found in the inspected log pages.
- No HTTP 500 was observed on the specified interview/offer routes in those pages.

**These are observed matches, not complete seven-day incident totals.** Available log pages/cursors did not establish complete coverage. Zero search matches must not be interpreted as zero incidents, and that 502 alone does not establish a calendar rollback. Precise route/code totals remain an observability limitation.

### Workflow-v2 production cohort

| Current status | Applications | Any interview | Completed Advance | Any Final interview |
|---|---:|---:|---:|---:|
| interviewing | 3 | 3 | 0 | 1 |
| invited | 7 | 7 | 0 | 0 |
| new | 124 | 0 | 0 | 0 |
| offer_extended | 1 | 0 | 0 | 0 |
| shortlisted | 5 | 0 | 0 | 0 |
| under_review | 3 | 0 | 0 | 0 |
| withdrawn | 27 | 6 | 0 | 0 |
| **Total** | **170** | **16** | **0** | **1** |

### Source findings

Before these changes:

1. The Client outcome endpoint existed but the relevant frontend screens did not call it.
2. Offer messaging used the combined activation checklist, incorrectly presenting deposit/MSA/contract requirements as offer blockers.
3. Migration 0044 classified otherwise-unaccepted in-flight applications as v2, including the records below. Existing contract/accepted-state exceptions still mattered.
4. Five mutation paths performed shared calendar synchronization within their business transaction. Provider failure could therefore undo the interview.

## Production migration dry run

The production 0044 ledger cutover was **2026-10-28 09:22:56.040571 UTC**.

Migration 0047 only considers original v2 cohort snapshots captured by that cutover. Eligibility requires an original in-flight status (`interviewing`, `offer_extended`, `offer_declined`) or an interview created before cutover. Accepted-state snapshots, accepted offers, offer-linked deposits and contracts are excluded. Later-created cohorts are excluded.

The read-only production dry run identified **17** applications:

| Application ID | Job title | Current status |
|---|---|---|
| 05161211-5cd4-40bf-b920-ca2c407163d6 | Testing | withdrawn |
| 067ef289-5172-4354-9a93-b56b63332e44 | IT Administrator | invited |
| 296f141a-c98e-4725-bc8b-fb695cd2f00e | Testing | withdrawn |
| 3fe78a64-4b2d-4eb8-a6df-0040670e6b3c | Executive Assistant | invited |
| 462272be-189c-4704-930d-eef803ffae75 | Senior Account Executive – Salesforce Solutions | offer_extended |
| 63070f7c-c4b3-4946-8513-e9537d3818af | Executive Assistant | invited |
| 6883516e-f30b-455f-9c61-4ada17c859d5 | Sales Representative | interviewing |
| 6a945b34-2a94-43c6-9abb-2c7cb27f1583 | Executive Assistant | invited |
| 7c176abe-f6e7-4f9f-bbaf-bd37d1436189 | Executive Assistant | invited |
| 933a560e-1a11-4fff-93b6-c1a997c5a838 | Executive Assistant | invited |
| a0fecb91-3897-408e-976d-1c74ff8a6565 | IT Administrator | interviewing |
| a32e02b4-ffba-40f6-b262-7999f2ca73f0 | IT Administrator | withdrawn |
| c06595ac-2cea-4ee3-89f4-823e65527433 | Testing | withdrawn |
| c22fd0ce-a82a-435f-b01b-3386a1194048 | IT Administrator | withdrawn |
| e48c7f1b-6f74-4bdf-b205-7afd44977551 | Marketing Specialist (US Market Experience) | invited |
| f86c13ab-8c2b-6761-0201-46349f01cd38 | Executive Assistant | interviewing |
| f9609083-b26b-4b9d-ad93-cd6e07236fd8 | IT Administrator | withdrawn |

Breakdown: 3 interviewing, 1 offer_extended, 7 invited, 6 withdrawn. Reclassification does **not** reopen withdrawn applications, accept invitations, change application statuses, or waive financial requirements. The 127 `new`/`under_review` applications without interviews remain v2.

These counts describe the pre-implementation snapshot, not an automatically approved production UPDATE. Re-run the same eligibility review immediately before an authorized release.

## Changes

### Outcomes and interview types

- Shared controls are available in ClientProfile, ClientInterviews, AdminJobApplications and AdminInterviews, including earlier rounds.
- Existing Client outcome PATCH and new Admin outcome/type PATCH routes use the same transactional service.
- A past confirmed interview can record Advance, Reject or Pending, with optional internal notes.
- Pending can later resolve to Advance or Reject. Recorded types and resolved outcomes cannot be rewritten.
- Type can be edited before an outcome; marking an interview Final and recording Advance clears that offer prerequisite.
- Admin outcome/type and calendar retry permissions are confirmed against persisted Super Admin/TA roles. Clients remain restricted to owned applications.
- Recruiting stage overrides now permit TA as well as Super Admin, require a written reason and retain status history. Financial permissions are not broadened.

### Messaging and scheduling

- Onboarding exposes `offerBlockers`, `activationMissing` and a current-stage checklist.
- Client offer controls no longer display post-acceptance activation requirements as offer blockers.
- MSA upload warnings are Super Admin-only; Client activation language explains that OnSpot is preparing the agreement.
- The actual Client scheduling dialog handles SHORTLIST_REQUIRED with a one-click Shortlist action. It fetches the latest application version, calls the existing audited status endpoint and retries the original scheduling request.

### Calendar resilience

- All five previous business-transaction sync calls now run after COMMIT in a separate synchronization transaction.
- Provider failures save `failed` and a safe error code, preserve confirmation, and alert Super Admin/TA through a bell type enabled in the role allow-list.
- Admin interview cards provide Retry calendar sync via `POST /api/admin/interviews/:id/calendar-sync`.
- Retry is serialized per interview and reuses the existing Graph transaction/event identity, including lost-response recovery.
- Shared-calendar conflicts require Admin resolution but do not roll back confirmation. Talent's own overlapping interviews remain a hard conflict.
- Unmanaged interviews return before applicant joins/stage validation; cancellation without a stored event never generates an events/null request.

### Talent

- Past proposed times are removed from accept choices, with a periodic refresh and the explicit “These times have passed — propose new times” state.
- Past counterproposal inputs cannot be submitted.
- Every 409 refreshes interviews and displays the server message, including expired-time and stale-turn errors.

## Migrations and release boundaries

### Code locations

- Outcome authorization, locking and immutable results: `server/services/interviewOutcomeService.ts`.
- Separate calendar transaction, failure notifications and serialized retries: `server/services/interviewCalendarSync.ts`.
- Managed/unmanaged calendar behavior and Graph idempotency: `server/services/findWorkCalendarService.ts`.
- Outcome/type/retry endpoints and the five post-commit call sites: `server/routes.ts`.
- Offer vs activation checklists: `server/services/contractorOnboardingStatus.ts`, `client/src/components/ContractorOnboarding.tsx`.
- Recruiting override policy: `server/services/contractorOnboardingPolicy.ts`.
- Super Admin-only MSA warning: `server/routes/contractorOnboarding.ts`, `client/src/components/AdminMsaWarning.tsx`.
- Shared outcome controls: `client/src/components/InterviewOutcomeControls.tsx`.
- Mounted interview controls: `client/src/pages/ClientProfile.tsx`, `ClientInterviews.tsx`, `AdminJobApplications.tsx`, `AdminInterviews.tsx`.
- Client Shortlist/retry dialog: `client/src/components/InterviewWorkflowUi.tsx`.
- Talent expiry/refetch behavior: `client/src/pages/TalentApplications.tsx`.
- Bell visibility and presentation: `client/src/lib/notificationRouting.ts`, `client/src/components/NotificationBell.tsx`.
- Nullable calendar fields: `shared/schema.ts`; additive SQL migrations listed below.
- Native tests/harness: `server/tests/interview-workflow.fixture.ts`, `interview-scheduling-v1.test.ts`, `hiring-flow.fixture.ts`, `scripts/test-hiring-payments-isolated.mjs`.
- Browser regression: `scripts/test-interview-workflow-ui.mjs`.

- `0047_inflight_interview_cohorts.sql`: adds nullable reason/migrated_at metadata; conservatively repairs original unaccepted in-flight cohorts. Re-running it does not reclassify repaired rows again.
- `0048_interview_calendar_sync.sql`: adds nullable calendar status/error columns and a status check.
- 0044/0045 are unchanged.
- Development schema inspection confirmed all four new columns exist after the normal development restart.
- Disposable PostgreSQL tests verify reclassification/idempotence and unchanged existing security_deposits rows.
- A legacy eligible application can still receive an offer; newly accepting that offer promotes it to invoice-first. Re-running the repair cannot reverse that accepted application.

Schema additions are non-destructive, but 0047 intentionally changes eligible cohort data. Neither migration has been applied to production by this work.

Rollback: prefer reverting application code while retaining the nullable additions and audit metadata. Do not blindly reset cohort versions or drop columns. If a cohort correction needs reversal, first review only rows bearing this repair's reason/timestamp and preserve all newly accepted invoice-first applications. Use an approved database restore/forward correction rather than bulk cohort rewrites.

## Verification

| Check | Result |
|---|---|
| Onboarding native PostgreSQL suite | 17 passed |
| New outcome/calendar/cohort native PostgreSQL fixture | 4 passed |
| Interview scheduling, real HTTP/JWT middleware + native PostgreSQL | 32 passed |
| Hiring flow, actual production route callbacks + mocked Graph | 11 passed |
| Hiring payments native PostgreSQL | 16 passed |
| Actual Client scheduling dialog in isolated browser | Passed |
| TypeScript | Passed |
| Production build | Passed |
| Development application restart / public preview | Passed |
| Unauthenticated Admin endpoint guard workflow | Passed after restarting against the running server |

**80 backend tests passed.** The browser test uses the real dialog but mocked HTTP responses: SHORTLIST_REQUIRED → latest version lookup → audited status API request → identical scheduling retry.

The HTTP tests use synthetic users and signed fixture JWTs in a disposable database. They are not real password logins to approved development/production accounts. Graph responses, provider failures and outbound delivery are simulated. The signed-in UI and actual Outlook delivery have not been verified with real accounts. Public preview was visually checked; unrelated Lindy embed authorization and missing Stripe public-key console warnings remain outside this change.

A Node 22 test-worker IPC serialization failure occurred during the full Express suite. Running its node:test module directly removed the IPC issue without skipping assertions; all 32 cases passed.

## Published-app UAT script — run only after an authorized release

Use approved disposable Client, Talent, TA and Super Admin accounts. Use a real approved test job and labeled test applications. Do not reuse customer hiring records, send real money, fabricate receiving details or claim independent payment verification. This document is a script, not a record of executed production UAT.

1. **Sign in as Client.** Open a new v2 application. Verify the offer blocker is Shortlist, not MSA/deposit/signatures.
2. **Shortlist then schedule.** In a stale/open scheduling dialog that receives SHORTLIST_REQUIRED, click Shortlist once. Verify status history records the change and the same proposed time is scheduled. Check the appropriate Talent interview proposal alert/email.
3. **Talent picks a future time.** Verify the request is confirmed, localized times agree, and confirmation notifications/emails reach the expected Client/Talent recipients. For Admin-managed rounds also confirm the actual FindWork event/invitation.
4. **Initial outcome.** After its confirmed start, record Initial → Advance. Verify the offer remains blocked specifically by the missing Final round, not activation prerequisites. Attempt a type change afterward; expect 409.
5. **Final round.** Schedule/select/confirm a Final interview. After its confirmed start, record Pending, then Advance. Refresh or switch devices; the offer action must be enabled. Rewriting Advance/Reject must fail.
6. **Send an offer.** Verify the Talent offer alert/email and persisted offer status. Initial outcome alone must never have unlocked this new-v2 offer.
7. **Accept the offer.** Verify invoice-first deposit creation and the post-acceptance activation checklist. Existing deposit, payment, contractor agreement and current signed MSA gates must still apply. Do not mark a real obligation independently verified as part of this no-money script.
8. **Admin-managed provider failures.** In approved staging, simulate mailbox denial, timeout and shared-calendar busy responses. Confirm the interview remains confirmed, sync status is failed, an authorized Admin receives the warning and unauthorized roles cannot retry.
9. **Retry/recovery.** Resolve the underlying mailbox/conflict issue. Retry from AdminInterviews, including a lost-response scenario. Verify exactly one invitation event and a synced state; retry again without creating another event.
10. **Talent overlap.** Attempt a second confirmed interview overlapping that Talent's own appointment; expect a hard 409 even when shared calendar failures are only warnings.
11. **Expired proposals.** Use approved staging time controls/test fixtures. No past acceptance choice should remain. All-past proposals show the explicit message and permit proposing a future time.
12. **Stale turn.** Open two sessions. Change the proposal/turn in the second, then submit from the first. Verify the server message and automatic refetch rather than a persistent stale action.
13. **Role checks.** TA and Super Admin can record outcomes and use written recruiting-stage overrides. Client Success and Clients cannot use Admin outcome/type/retry APIs. Clients cannot alter another Client's interview. Financial settings/approvals remain governed by their pre-existing permissions.
14. **Cohort sample.** Review selected IDs from the dry-run list after the approved migration. Withdrawn remains withdrawn; invitations still require their original consent; an existing offer can be accepted but its fresh acceptance must issue a deposit before agreements.

## Remaining production readiness checks

- [ ] Approve and re-run the production read-only cohort dry run before release.
- [ ] Apply 0047/0048 only through the authorized release process.
- [ ] Complete the approved-account UAT above and verify actual outbound emails/calendar invitations.
- [ ] Confirm FindWork Graph permissions and retry resolution using the actual staging mailbox.
- [ ] Improve route/code log coverage before relying on precise seven-day failure totals.
