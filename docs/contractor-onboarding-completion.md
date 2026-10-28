# Contractor onboarding — development implementation

## Approved flow

Application → Shortlisted → Interview → completed Final interview with Advance/Passed outcome → Offer → accepted-offer security deposit invoice → independently verified deposit → private Contractor Agreement (Talent + OnSpot) and current signed Client MSA → Hired/Active.

- No new application statuses represent invoices, receipts or financial settlement.
- The accepted offer's existing deposit formula and currency remain authoritative.
- A receipt, reference, screenshot or upload does not independently settle anything.
- New private agreement drafts cannot be prepared or sent before held funding.
- One Client MSA signature is reused only for that immutable current document/version.
- Publishing a new MSA does not rewrite already-active engagements.
- No legal document or receiving-account details are seeded.

## Step 0 findings and replacements

The previous implementation already contained `contract_signed`, deposit-funded activation, the persisted pre-offer-payment setting, independent Manual Wise review, private contract documents, editable lifecycle emails, durable delivery deduplication and Super Admin authorization checks. Those capabilities were retained rather than replaced.

The old sequence created the contract first and issued a deposit after its final signature. That remains the historical path. For new acceptances it is replaced by:

1. Invoice issuance in the offer acceptance transaction, uniquely keyed by accepted offer.
2. An offer/submission-linked deposit whose contract link is initially nullable.
3. An idempotent post-commit private agreement draft after verified settlement.
4. A single locked activation helper requiring held funds, all contractor signatures and the Client's signature of the active effective MSA.

The old broad interview/offer eligibility checks are narrowed for new-flow applications. A database-confirmed Super Admin can record a written, action-specific exception. Client/Talent requests cannot grant themselves that exception. Initial offers, both counter writers and expiry renewal enforce the final-interview prerequisite.

The pre-invitation checkbox remains a separate acknowledgement. Its preserved fields do not count as a document signature. Combined interview invitations become Shortlisted but retain explicit pending Talent consent; acceptance/decline remains ownership-scoped and race-safe.

## Migration

`migrations/0044_contractor_onboarding.sql` adds the workflow cutover registry; nullable contract linkage and accepted-offer uniqueness for deposits; invoice void preservation; the invitation-pending marker; separate invitation acknowledgement fields; and private versioned MSA documents, requests, review receipts and signatures.

It does not delete/reprice historical charges or change payout, monthly invoice, tax, rate or timesheet calculations. Existing past-offer records are classified as legacy, not moved to the new sequence. Reapplying the migration preserves explicit new-flow classifications. A **fresh acceptance after cutover**, including a renewal or counter on a legacy application, promotes that application to invoice-first in the acceptance transaction. See `docs/contractor-onboarding-prepublish-audit.md` for the exact predicates, production read-only inventory, migration rehearsal, rollback and published-app UAT script.

`migrations/0045_onboarding_billing_activation.sql` preserves the executed-contract immutability guard while allowing a new-flow signed agreement's initially-null billing activation timestamp to be set once, at the actual Hired transition, only with held funds and the signed current MSA. It never permits changes to an existing timestamp, effective start date or terminated contract. This is necessary when the MSA is signed after the Contractor Agreement.

MSA documents use the existing private contract blob provider, passive-PDF validation and SHA-256 integrity checks. The API returns PDF bytes only after owner/Super Admin authorization; storage keys are not returned. Evidence binds client, document/version/hash, server account email, typed name, consent, IP, user agent and timestamp.

## Main implementation files

- Policy, progress and activation: `server/services/contractorOnboardingPolicy.ts`, `contractorOnboardingStatus.ts`, `hiringLifecycleEvents.ts`.
- Funding and post-commit agreement work: `manualWiseService.ts`, `paidAgreementService.ts`, `hiringLifecycleDispatch.ts`.
- Private documents and MSA: `contractDocumentService.ts`, `hiringContractService.ts`, `clientMsaService.ts`, `server/contractDocumentRoutes.ts`, `server/routes/contractorOnboarding.ts`.
- Existing route integration and renewal: `server/routes.ts`, `server/services/offerExpirationService.ts`.
- Existing-math/schema/status compatibility: `shared/schema.ts`, `shared/submissionStatuses.ts`.
- Editable defaults: `server/seeds/seedEmailTemplates.ts`; corresponding Admin template category labels/editor options.
- Shared UI: `client/src/components/ContractorOnboarding.tsx`, `ContractApplicationPanel.tsx`, `InterviewWorkflowUi.tsx`, `OfferExpirationRenewal.tsx`.
- Shared frontend policy: `client/src/lib/contractorOnboarding.ts`, `talentInvitationState.ts`, and their focused tests.
- Role views: `ClientProfile.tsx`, `TalentApplications.tsx`, `AdminJobApplications.tsx`; new `ClientMsa.tsx`, `AdminMsaDocuments.tsx`, `AdminContractorOnboarding.tsx`; Admin Settings and App routing.
- Tests: `server/tests/contractor-onboarding.fixture.ts`; preserved hiring/payment/document/Manual Wise fixtures; new focused frontend/browser tests and the disposable database runner.

## D7 — development records preserved

Read-only development preflight identified these existing past-offer records:

| Submission ID | Existing status |
|---|---|
| `06fdf723-3445-4fb8-b88b-bb176b63f2d7` | offer_accepted |
| `56e4f17c-c5b7-4846-b570-974283385a69` | hired |
| `p3b-guaranteed-1790769819585-606179-submission` | hired |
| `p3b-tracked-1790769798751-716810-submission` | hired |
| `p3b-tracked-1790769819585-606179-submission` | hired |

After the development restart, all five were rechecked: each retains the status above and workflow version 1. These are development findings only. No production database was queried or migrated. Production cutover will classify the records actually present there at migration time.

## Verification

Native tests own disposable PostgreSQL databases. Their actors, payment references, QR metadata and PDF documents are synthetic; external blob transport is simulated. These are not approved-account sign-in UAT, live Wise verification, real-money settlement or an external-inbox delivery claim.

| Check | Actual result |
|---|---|
| New PostgreSQL onboarding fixture (`--onboarding-only`) | 9 passed; includes all six condition/callback orders and concurrent activation attempts |
| Existing hiring-flow fixture (`--hiring-flow-only`) | 11 passed |
| Existing hiring-payment fixture (default runner) | 16 passed |
| Private contract-document fixture (`--contract-documents-only`) | 15 passed, 1 skipped |
| Existing Manual Wise integration fixture | 23 passed |
| Existing billing regression fixtures (`--regressions-only`) | 59 passed across five suites |
| Focused frontend unit fixtures | 6 passed |
| Focused Playwright fixtures | 2 passed, with mocked authenticated state/network responses |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed |
| Running development preview | Homepage rendered; Vite connected; protected MSA/progress APIs returned 401 without credentials |

The skipped contract check is an external storage configuration probe; it does not establish durable provider storage readiness. The unrelated pre-existing `admin-auth-check` workflow has a network-error result and is not counted as passing approved-account UAT. Existing preview warnings include the Lindy embed authorization configuration and missing Stripe public key.

Both additive migrations have been exercised against disposable PostgreSQL and applied to development through the existing development workflow. Read-only development checks confirm: pre-offer fee setting `false`, no active MSA seeded, deferred activation immutability guard installed, and all five historical classifications preserved. No production migration or publishing was performed.

Native regression work caught and corrected the MSA audit parameter-type mismatch and the old executed-contract rule that prohibited initial deferred billing activation. No signed billing start date or existing activation timestamp was made editable.

Approved-account UAT and the rendered signed-in role screens were **not verified** in this session. The activation-order matrix uses explicitly synthetic canonical states to test callback safety; it does not bypass the real pre-payment contract preparation/signing guards or claim legal execution.

## Production readiness checklist

- [ ] Review and apply the additive migration through the approved production release process; inspect production legacy classifications.
- [ ] Confirm approved Wise configuration, supported currency, deposit-funding authorization, private QR persistence and emergency-deactivation behavior.
- [ ] Upload the legally approved MSA PDF, review its immutable hash/version/effective date and explicitly activate it. Without one, activation correctly remains blocked.
- [ ] Perform approved-account Client, Talent and Super Admin UAT in a separately isolated environment.
- [ ] Verify external email delivery and real post-login destinations with approved test inboxes; inspect retry/ambiguous-delivery records without claiming failed transport succeeded.
- [ ] Verify durable private PDF/receipt object persistence and unauthorized read denials against the configured storage provider.
- [ ] Confirm all three activation prerequisites and exactly-once billing/Hired notifications in that UAT.
- [ ] Obtain release approval. No publishing or production migration is performed by this implementation.
