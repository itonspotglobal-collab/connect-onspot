# Contractor onboarding: diagnosis, controls and UAT

## Release boundary

No publication, production migration, production repair or production financial
write was performed. Production queries were read-only. Positive settlement
tests used owned, disposable PostgreSQL with synthetic records; authentication
adapters and evidence storage in those fixtures are explicitly simulated.
They are **not** real signed-in account UAT or independent Wise verification.

## Production diagnosis — 2026-10-30 UTC

The live public API returned job `772b0b2a-f89e-41af-87ac-f9bf3201e63d`,
“AI / AUTOMATION ENGINEER”; the production read-only database returned the same
ID/title. This independently established database identity before interpreting
the application records.

The latest successful deployment build found was
`50950e41-22a9-41cd-9673-c4864cd9240e`, updated 2026-10-29 09:07:17 UTC.
The platform did not expose its Git SHA. Its timing closely matches the local
“Published your App” commit `2bcfdceb`, but that SHA is a correlation, not
provider-confirmed build metadata.

`741c4cba`, `feaef1b4`, and current main at investigation start (`52811bf5`)
postdate that successful build and are not live. The production migration
ledger ends at `0046_hiring_payment_waivers`; **0047, 0048 and 0049 are not
applied**. Neither are 0050/0051.

### Requested Executive Assistant application

| Record | ID / value |
|---|---|
| Application | `f86c13ab-8c2b-6761-0201-46349f01cd38` |
| Job | `a418cbc7-f26c-406c-bacf-2bcccf87ed0e` — Executive Assistant |
| Status / cohort | `offer_accepted` / workflow version **2** |
| Cohort captured status | `offer_accepted` |
| Same Talent + job submissions | **1**, the application above |
| Offer | `e49b9c88-858a-4188-a0bd-ee0835381faa` |
| Offer submission / status | Same application / `accepted` |
| Offer created | 2026-10-29 12:11:21.136 UTC |
| Offer accepted | 2026-10-29 12:15:35.747 UTC |
| Deposit | `cb900472-2151-459d-8457-e14230a07fba` |
| Deposit source / status | Correct offer and application / `pending` |
| Contract on deposit | None yet |
| Wise obligation | `f9383fcc-b740-426b-b2c6-6cec2bc8e19f` |
| Obligation configuration / proofs | None / **0** |

These are the only offers/deposits found through the same Talent/job
submissions and their offer/contract links.

History, in order:

1. 2026-10-21 03:31:54 UTC — Super Admin approved the Client shortlist request.
2. 2026-10-21 13:01:54 UTC — Client scheduled a Final interview; status became
   `interviewing`.
3. 2026-10-29 12:10:22 UTC — Super Admin restored `shortlisted`, note “bypass”.
4. 12:11:21 UTC — Super Admin recorded an offer prerequisite override,
   “bypass for testing”, then extended the offer.
5. 12:15:35 UTC — Talent changed `offer_extended` → `offer_accepted`, note
   “Talent accepted the offer”.
6. 12:15:36 UTC — system recorded deposit invoice issuance, awaiting independent
   settlement verification.

The acceptance actor is the application’s Talent account. The note matches
the normal Talent acceptance handler in `server/routes.ts`
(`/api/talent/offers/:id/respond`). History does not persist the HTTP request
path, and the available production logs did not establish that exact request;
the route attribution is therefore an inference, not request-level proof.

The Final interview remains **confirmed**, without an Advance/Passed outcome.
An Initial interview is **proposed**. Thus Final is factually incomplete despite
the recorded Super Admin bypass. The deployed status service should nevertheless
select payment as current when it finds this accepted offer. The reported
highlight on Final was **not reproduced in an authenticated production
session**, and cannot be attributed to missing/duplicate offer data.

### Confirmed operational blockers

- Active USD Wise configurations: **0**.
- Active USD configurations with deposit funding authorization: **0**.
- Active, effective MSA documents: **0**.
- Applications in `offer_accepted`, `contract_sent`, or `contract_signed`
  without an accepted offer: **0**.
- Applications in those statuses without a deposit for their accepted offer:
  **0**.

The target does **not** need a fabricated offer or another invoice. Its existing
obligation has no destination because no active configuration exists.

## Implemented boundaries

- Repair requires a Super Admin, read-only dry-run plan, fingerprint, explicit
  confirmation and a 10–2000 character reason. Retries retain original rows.
  Duplicate linkage uses a canonical application alias; it never changes
  immutable offer ownership or moves issued financial snapshots.
- External payment recording uses `ManualWiseService.settle()`, as real Wise
  proof review does. Exact amount/currency, received date, method, reference and
  an explicit settlement attestation are mandatory. Partial amounts fail
  without changing the pending deposit. References are protected across both
  settlement mechanisms.
- Deposit deferral uses `hiring_payment_waivers.scope='deposit'`. It permits
  agreement preparation/signing but is not funded cash and never satisfies
  activation. The invoice remains pending, with an agreed due date. Reminders
  are due 3/7/14 calendar days after the arrangement; a Super alert is due
  14 days after its agreed due date. Retried events are deduplicated.
- Waivers require an arrangement note and create no held funds, independent
  settlement or payout coverage. The waiver reason is visible in onboarding
  and the financial ledger. Activation still needs its other legal conditions.
- An offline MSA record needs an actual signed PDF, signer identity/date,
  approved active canonical version and reason. It is separate version/hash-bound
  evidence, **not** a forged platform electronic signature. Private evidence is
  readable only through authorized endpoints.
- Setup warnings are Super-only. Missing prerequisites produce a daily
  deduplicated Super alert while accepted work remains.
- The tracker uses accepted offers, deposits, proofs, contracts and MSA evidence.
  An accepted-status application without an accepted offer explicitly needs
  OnSpot review. Talent responses omit deposit and payment-state details.
- Existing `pre_offer` exceptions retain their original identity and debt.
  A deposit exception cannot discharge an old deferred hiring invoice.

### Main implementation files

- `server/services/onboardingRepairService.ts`
- `server/services/depositBillingService.ts`
- `server/services/depositArrangementState.ts`
- `server/services/onboardingPrerequisites.ts`
- `server/services/manualWiseService.ts`
- `server/services/contractorOnboardingStatus.ts`
- `server/services/contractorOnboardingPolicy.ts`
- `server/services/paidAgreementService.ts`
- `server/services/hiringLifecycleEvents.ts`
- `server/services/hiringLifecycleDispatch.ts`
- `server/services/depositReminders.ts`
- `server/services/clientMsaService.ts`
- `server/routes/contractorOnboarding.ts`
- `client/src/components/deposit-billing/`
- `client/src/components/ContractorOnboarding.tsx`
- `client/src/components/AdminMsaWarning.tsx`
- `client/src/components/manual-wise/ManualWisePaymentPanel.tsx`
- Admin onboarding, application and ledger pages; `shared/schema.ts`.

New migrations only:

1. **0052_deposit_billing_controls.sql** adds scoped arrangements, canonical
   duplicate links, external payment evidence and private offline MSA evidence.
   The prior active-waiver index is replaced by scoped uniqueness; no waiver
   or deposit rows are deleted.
2. **0053_deposit_activation_evidence.sql** preserves signed start-date
   immutability while allowing the first valid activation with an audited
   waiver and/or offline MSA evidence. Without it, the prior database trigger
   rejects these otherwise-valid activations.

Existing migration files and deposit/rate/invoice/timesheet/payout formulas were
not rewritten.

## UAT prerequisites and financial truthfulness

### Completed verification

| Check | Actual result |
|---|---|
| Deposit controls, permissions, repair, storage adapter, canonical settlement and migration reapply | **9/9 passed** |
| Current/retired hiring-payment policy and historical debt | **7/7 passed** |
| Contractor onboarding fixtures | **17/17 + 5/5 passed** |
| Manual Wise integration | **23/23 passed** |
| Interview integration | **32/32 passed** |
| Hiring overrides | **5/5 passed** |
| Hiring flow | **11/11 passed** |
| Notification integration | **2/2 passed** |
| TypeScript / production build | Passed |
| Development anonymous admin-job API checks | **12/12 returned 401** |
| Development protected-route screenshot | Rendered Staff access login; auth remained enabled |

Migration reapply was tested after deposits and payment evidence existed:
0052/0053 reapplied without changing their full JSON row snapshots. This was
an owned disposable database, **not a production branch/schema-copy dry run**.

The old fee fixture was updated, not the business policy: it had reapplied the
superseded fee migration and expected new recruiting fees. Its replacement
retains historical invoice immutability, role/ownership checks, rejection/
resubmission, no partial settlement, reference uniqueness, debt identity and
post-acceptance deposit gates.

No approved real authenticated Client/Talent/Super session, real bucket
persistence or external inbox delivery was verified. The screenshot was
unauthenticated and therefore did not show the protected new forms.
The browser also reported an unrelated existing Lindy widget authorization
configuration error and missing development Stripe public key; these were not
changed or represented as onboarding test failures.

Use approved Client, Talent and Super Admin accounts, plus TA/Client Success
accounts for denial tests. Do not share passwords in chat.

**A no-money production test must not assert that money was received when it
was not.** Run the complete positive A flow in an isolated staging publication
with a disposable database/storage and clearly labelled synthetic obligations,
not the live financial ledger. In production, test A’s validations and cancel
before settlement, or proceed only after a truthful actual external receipt.
Never check “independently verified” merely to advance a test.

For C, a genuinely approved, reasoned test waiver needs no payment and makes no
cash claim. Keep any test engagement out of real work, payroll and payouts.

Before testing:

1. After separate release approval, confirm the release includes migrations
   0047–0053 and that the publication succeeds through the normal Publish flow.
2. Super Admin uploads/reviews/activates approved USD receiving instructions
   using the actual authorized recipient; do not invent account details.
3. Upload/review/activate the approved effective canonical MSA version.
4. Publish/review the editable email templates, use approved test inboxes, and
   confirm the application’s approved public origin is used in CTA links.
5. Record the test application/offer/deposit IDs. Check the repair queue first;
   dry-run any proposed repair before confirmation. Do not repair this
   production target by creating a duplicate debt.

## UAT A — accept → externally received deposit → agreements → MSA → Active

| Step / account | Action and expected result | Expected email |
|---|---|---|
| Client / Super | Use a properly shortlisted application, completed Final Advance/Passed interview, and legitimate offer. Any recruiting exception needs its own authorized reason. | Normal offer email to Talent when extended. |
| Talent | Accept. One accepted offer and exactly one pending deposit invoice; not Hired/Active. | Acceptance confirmation to Talent; acceptance notification and separate deposit invoice email to Client. |
| Super | Open Payment verification. Attempt partial amount, wrong currency, future date, missing reference/reason or absent attestation. Each fails; deposit stays pending. Cancel here for a no-money live-production test. | No “paid” email. |
| Super, isolated positive test or truthful real receipt only | Record the exact external amount/currency, actual received date, reference and method; attach optional private receipt. Confirm only after verifying the actual receipt. | Client: **Deposit Recorded Outside Platform**. Super: agreement-ready notification/email. No claim of Wise verification. |
| Super | Retry the same command / refresh. One external receipt and one held deposit, no duplicate settlement or invoice. Download the private receipt while authorized; unauthorized accounts cannot read it. | No duplicate paid confirmation on retry. |
| Super | Prepare, inspect and send the Contractor Agreement PDF. Do not bypass legal requirements for this test. | Normal contract invitation to required signer(s). |
| Talent + OnSpot (+ Client/Organization if required) | Read and sign every required agreement. Partial signatures cannot activate. | Existing contract-signature notifications; no Active email yet if Client MSA is missing. |
| Client | Read/sign the current MSA. Alternatively Super records the actual previously signed PDF, signer/date/reason against that same active version. | Existing MSA-required message where issued; offline evidence never masquerades as an electronic signing event. |
| All | After held deposit, complete Contractor Agreement and valid Client MSA: application becomes Hired, engagement Active, activation timestamp is set once. | **Client Engagement Active** to Client; **Talent Engagement Active** to Talent, with agreed start date. Existing Hired alerts remain deduplicated. |

Check that an unrecognized receiving destination is never shown when collection
is deactivated. Re-enable only through a fresh authorized configuration review.

## UAT C — accept → waived deposit → agreements → MSA → Active

1. Create another approved test offer and accept as Talent. Verify one pending
   deposit and the two Client acceptance/invoice messages plus Talent acceptance.
2. As Super, choose **Waive deposit**. A short/missing reason or arrangement
   note must fail. Enter the actual approved special arrangement and confirm.
3. Client sees **Deposit waived by OnSpot** and receives the editable
   **Deposit Waived** email. Ledger/onboarding show the reason.
4. Deposit status is `waived`, not `held`/`paid`; no settlement evidence or
   available deposit cash is invented. The old collection destination is
   unavailable. Any attempted receipt approval fails.
5. Prepare/send and complete all required agreement signatures; complete the
   current Client MSA (or truthfully record its offline signed evidence).
6. Only then is the engagement Active. Client receives
   **Client Engagement Active — Deposit Waived**; Talent receives the normal
   Active message without payment details. Neither message claims a received
   deposit. Billing/payout cash-coverage checks must not treat the waiver as
   cash funding.

## Additional UAT

- **B:** Defer with a genuine due date. Agreements can prepare/sign while the
  invoice stays open; fully signed legal documents alone cannot activate.
  At 3/7/14 days check one reminder per milestone; at 14 days overdue check
  the Super alert. Only a subsequent real held settlement permits activation.
- Client, Talent, TA and Client Success cannot call any repair/payment/MSA
  administrative mutation, even if they know a record ID.
- Without Wise/MSA setup, Super sees exact warning(s); Client sees a neutral
  setup message, not a request to pay an invalid destination.
- Missing-offer anomalies show OnSpot-review copy, never a fabricated earlier
  stage. A duplicate link retains the original offer/invoice ownership.
- Observe delivery in approved test inboxes and private evidence persistence
  after refresh/sign-out/sign-in. Source tests are not external-email UAT.

## Rollback

Keep evidence and financial history. Prefer a prior compatible application
release with new writes disabled; **do not** automatically drop these tables
or erase audit rows. The original single-scope index cannot be reinstated if
both scopes now coexist without a deliberate, reviewed compatibility plan.
Restoring the earlier activation trigger blocks future waiver/offline-MSA
activations but does not undo already-active engagements. Never clear
activation timestamps or rewrite signed start dates as a rollback.

## Production readiness checklist

- [ ] User approves publishing; no release was initiated here.
- [ ] Required versioned migrations validated and applied through Publish.
- [ ] Actual authorized Wise destination and active MSA are configured.
- [ ] Approved authenticated account UAT is completed on the released app.
- [ ] Actual private storage persistence and access are checked.
- [ ] Editable messages and CTA destinations are verified in approved inboxes.
- [ ] Positive A test uses truthful funds or isolated staging, never fake
      production settlement.
- [ ] Super reviews any proposed production repair; this target already has
      the correct accepted offer and deposit.
