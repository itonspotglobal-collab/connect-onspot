# Contractor onboarding: pre-publish audit and UAT

Audit date: 2026-10-28 UTC. **Not published. No production writes or production migrations performed.**

## 1. Exact legacy / invoice-first classification

### At migration cutover

`migrations/0044_contractor_onboarding.sql` inserts one cohort record for every application present at cutover:

- Version **1 (legacy)** if its current status is `offer_accepted`, `contract_sent`, `contract_signed` or `hired`; **or** any related offer already has status `accepted` / `offer_accepted`; **or** any related `hiring_contracts` row exists (including a historical/void agreement).
- Version **2 (invoice-first)** for every other application. In particular, `offer_extended` alone is NOT legacy.
- `ON CONFLICT DO NOTHING` preserves a previously recorded decision. The migration does not move statuses, recreate invoices, cancel interviews or rebill old contracts.
- `captured_at` is audit evidence, **not** a runtime date comparison. Job creation date, application age, proposer role and an expired/renewed deadline do not determine the policy.

### At runtime

`server/services/contractorOnboardingPolicy.ts`, `isDepositFirst()`:

```ts
return r.rows[0]?.workflow_version !== 1;
```

Only an explicit version 1 is legacy. Version 2 **and no cohort record** are invoice-first. SQL/read failures propagate; they do not fall back to legacy.

**Fresh acceptance is stronger than grandfathering:** `issueAcceptedOfferDeposit()` now promotes the application to version 2, under the onboarding lock, in the same transaction as the successful offer acceptance and invoice issuance. This applies even if the application was originally legacy. The two callers are the Client counteroffer acceptance and Talent offer acceptance callbacks in `server/routes.ts`. Both require an actionable sent offer and roll back together on failure. Initial and Super Admin-created offers use the same `/api/client/offers` writer and Talent acceptance callback; renewals reuse the same offer and callback.

Historical already-accepted offers are not replayed through this helper on startup. A duplicate acceptance request fails its pending-offer checks rather than reclassifying or rebilling it. Existing agreements, deposits and invoices remain intact. A genuinely fresh counter/renewal acceptance cannot use the signing-first waiver. It creates an accepted-offer deposit before a new agreement may be prepared or sent.

Payment-before-agreement enforcement is in `requirePaidContract()`, called by `hiringContractService.ts` and `contractDocumentService.ts`. Activation requires held funding, both Talent + OnSpot contractor signatures, and a signature bound to the current effective MSA document/version/hash, in `hiringLifecycleEvents.ts`, `tryActivateEngagement()`.

### Acceptance proof

`server/tests/contractor-onboarding.fixture.ts` and `server/tests/fixtures/onboarding-offer-handlers.ts` execute the actual source-extracted production offer callbacks with disposable PostgreSQL records:

1. Initial Client offer → Talent accepts.
2. Super Admin creates the offer through the shared writer → Talent accepts.
3. Talent counteroffer → Client accepts.
4. Talent counter → Client counter → Talent accepts.
5. Expired offer is renewed using `extendOfferExpiration()` → Talent accepts.

Each case starts with an explicit **legacy** cohort to test the strongest exception. Each asserts promotion to invoice-first, one pending deposit with no contract link, blocked direct signing-first contract creation, no contract created, and idempotent deposit retry. A separate source-wiring assertion checks both acceptance callbacks call the canonical invoice helper before COMMIT.

These are real SQL and route-callback tests, **not real account logins**: middleware is not executed; actors are synthetic; outbound notifications/email are stubbed. Existing native signing tests continue to cover historical contracts.

## 2. Production read-only inventory

Used the production read-only query interface, not development-shell `DATABASE_URL` or a legacy Neon secret. Independently correlated two public job IDs from the live published sitemap with the queried jobs table:

- `a418cbc7-f26c-406c-bacf-2bcccf87ed0e` — Executive Assistant
- `b5cb83ea-7fb0-48de-b7bf-e895d5b45919` — Website Developer

Published origin was obtained from deployment metadata: `https://connect.onspotglobal.com`.

### Group A: offer_extended / offer_accepted / contract_sent — **1**

| Application ID | Job title | Current status |
|---|---|---|
| 462272be-189c-4704-930d-eef803ffae75 | Senior Account Executive – Salesforce Solutions | offer_extended |

This application has no accepted offer and no contract. It will be **invoice-first**. Its existing pending offer is not deleted or recreated; accepting it after release issues a deposit invoice before any new agreement can be prepared. The final-interview rule governs new offer creation, countering and renewal; release does not invalidate an already-sent offer or add a new final-interview check to its acceptance.

No applications were returned in `offer_accepted` or `contract_sent` at audit time. If any enter those states before cutover, the migration's historical-evidence predicate classifies them at the actual cutover snapshot. Re-run the audit during the release freeze.

### Group B: interviewing without a completed Final Advance/Passed — **3**

| Application ID | Job title |
|---|---|
| 6883516e-f30b-455f-9c61-4ada17c859d5 | Sales Representative |
| a0fecb91-3897-408e-976d-1c74ff8a6565 | IT Administrator |
| f86c13ab-8c2b-6761-0201-46349f01cd38 | Executive Assistant |

All three have neither an accepted offer nor a contract and will be invoice-first. Their status/interview records stay unchanged. Normal offer creation, countering or renewal will return `FINAL_INTERVIEW_REQUIRED` until a Final interview is completed with `advance` / `passed`. A database-confirmed Super Admin may use the existing explicit written/audited prerequisite override; ordinary Clients and limited Admins cannot.

### Group C: new / under_review / reviewed with proposed or confirmed interviews — **0**

No IDs to list. If such records exist at release, do not delete/cancel their interviews or silently rewrite the application. They need shortlist before a newly gated scheduling operation (or an explicit Super Admin override). The gate is not a bulk cancellation of existing interviews; existing confirmation/outcome operations retain their own state rules.

### Re-runnable read-only audit

Run these SELECTs only against the verified production read-only interface:

```sql
SELECT js.id, j.title AS job_title, js.status
FROM job_submissions js JOIN jobs j ON j.id=js.job_id
WHERE js.status IN ('offer_extended','offer_accepted','contract_sent')
ORDER BY js.status,js.id;

SELECT js.id, j.title AS job_title
FROM job_submissions js JOIN jobs j ON j.id=js.job_id
WHERE js.status='interviewing' AND NOT EXISTS (
 SELECT 1 FROM interviews i WHERE i.submission_id=js.id
 AND i.interview_type='final' AND i.status='completed'
 AND lower(btrim(i.outcome)) IN ('advance','passed'))
ORDER BY js.id;

SELECT js.id, j.title AS job_title
FROM job_submissions js JOIN jobs j ON j.id=js.job_id
WHERE js.status IN ('new','under_review','reviewed') AND EXISTS (
 SELECT 1 FROM interviews i WHERE i.submission_id=js.id
 AND i.status IN ('proposed','confirmed'))
ORDER BY js.id;
```

No applicant names, email addresses, phone numbers or payment account details are included in this inventory.

## 3. Migration dry run and exact limits

No Neon branch or production connection was mutated. Exported PostgreSQL catalog definitions via SELECT, then reconstructed an owned, disposable local PostgreSQL cluster:

- All **112 public base tables**, with their columns, defaults, nullability, PK/unique/check/FK constraints and non-constraint indexes.
- Public sequences/enums, **19 public functions**, and non-internal table triggers.
- The **1 existing security_deposits row**, including all original column values, copied without user/profile parent data.
- No user/account rows, credentials, private receipt bytes or legal PDFs copied.

Because personal parent records were intentionally not copied, FK enforcement was disabled **only during ledger import in this disposable local cluster**. The real FK definitions were installed; normal origin mode was restored before either migration. This is a schema/ledger rehearsal, not a complete production data clone or authenticated UAT. Views, grants, extension installation, publication configuration, managed provider behavior and all other production row contents are outside this clone.

Executed `0044` and `0045` inside a transaction, rolled it back, then applied and committed both twice. The script checks:

- No pre-existing base table or column disappears.
- Every original deposit ID and every original deposit column value remains identical; count remains **1** on each pass.
- The second run produces identical column/default/nullability, constraint, function, index and trigger definitions.
- Transaction rollback restores the original schema definitions, including the old billing guard.

Result: **PASS**. The script accepts a catalog export path, never a live connection string:

```sh
node scripts/dry-run-onboarding-migrations.mjs /tmp/onspot-production-full-schema-audit.json
```

The catalog export is temporary audit input, not committed production data. Obtain a fresh catalog/ledger export using `scripts/queries/onboarding-production-catalog.sql` through the production SELECT-only channel to repeat it. Save the JSON cell itself (not its CSV-escaped wrapper) as the input file.

### “Additive” qualification

These migrations are **data-preserving, but not exclusively CREATE/ADD statements**:

- 0044 adds cohort/MSA structures, nullable accepted-offer links, new indexes/checks and invitation acknowledgement fields; backfills cohort decisions and eligible acknowledgement timestamps.
- It relaxes `security_deposits.hiring_contract_id` NOT NULL, replaces the status check with a superset, and creates/replaces an offer-void trigger.
- 0045 replaces the signed-contract billing guard function. It does not change any existing contract row.

The audit found production allows `drawn` and `replenishment_pending`; the migration now preserves both alongside existing statuses instead of rejecting future historical-ledger operations. No ledger row is deleted, repriced, reassigned or marked paid by these migrations. `security_deposits_source_check` is deliberately NOT VALID for historical data while enforcing provenance on future changes.

These migrations were previously applied in development, but production did not yet contain the cohort table. The versioned runner skips recorded migrations; editing an already-recorded file does **not** re-run it there. This pre-release amendment is intended for the still-unapplied production cutover. Existing development classifications are intentionally not rewritten.

### Rollback steps

1. Before an approved release: freeze hiring/payment mutations and schedulers, take a full provider backup/branch, save the production schema dump and original definition of `prevent_signed_contract_billing_start_change()`, record migration ledger state and deposit IDs/count/values, and re-run the read-only inventory. Do not allow the old runtime to accept offers while taking the cohort snapshot.
2. Apply both migrations with a release transaction before enabling the new runtime. On any error **ROLLBACK**: PostgreSQL restores the original constraints, functions, tables and data. This rollback was rehearsed locally.
3. If committed but no new-flow activity occurred: keep maintenance/freeze in place. Prefer leaving the compatible added schema in place while fixing forward. A previous application build must not be reopened for new offers/acceptances without review, since it would restore signing-first behavior.
4. If invoice-first deposits, MSA signatures or agreements already exist: **do not drop the new columns/tables, set contract links NOT NULL, erase invoices/signatures, or delete migration-ledger rows to force a rerun**. Retain the data and use a reviewed forward repair. An old binary is not automatically safe for these records.
5. Restoring the old billing guard is appropriate only under a freeze and after reviewing all new-flow records. Restore the exact pre-release function definition from the saved catalog, not an improvised function; the old guard can block valid new-flow activation.
6. Only if a full database restore is explicitly approved: restore the backup to a separate target, validate ledger totals and reconcile all post-backup payments/signatures/storage objects before any cutover. A raw backup restore can otherwise lose later financial activity. Do not perform it as an automatic code rollback.
7. After recovery: recheck original deposit IDs/values, pending acceptance uniqueness, private-document access and scheduler ownership before reopening mutations.

## 4. Admin warning

The main Admin Dashboard and Contractor onboarding page now show:

> New engagements cannot be activated until an MSA is uploaded

The explanation makes clear that a draft upload is insufficient: a Super Admin must review and activate it. The backend checks `active AND effective_at <= now()`, the same current-document condition as activation. It works even when there are zero accepted applications. An API error shows an explicit readiness-check error, never “ready.”

Files: `client/src/components/AdminMsaWarning.tsx`, `client/src/pages/AdminDashboard.tsx`, `client/src/pages/AdminContractorOnboarding.tsx`, `server/routes/contractorOnboarding.ts`.

The authorized dashboard UI was not viewed with a real account this turn. The warning has isolated render tests; the public preview check does not stand in for signed-in UI verification.

## 5. Published-app UAT script (not executed)

### Prerequisites and safety

- Run only **after an independently approved release**. This report does not authorize publishing or production migration.
- Use approved test Client, linked Talent, Super Admin and limited Admin accounts, in separate normal signed-in browser sessions, with accessible test inboxes. Do not change account passwords, forge tokens, bypass email ownership or use development auth switches.
- Use a clearly labeled test job with explicitly approved Lite/Standard, Tracked/Guaranteed, positive USD rate and agreed start date. Record application, offer, invoice and document IDs, never credentials.
- Confirm a current approved private MSA PDF is uploaded, reviewed and activated by Super Admin. Do not invent legal text or receiving details. The contractor PDF must also be an approved attachment-free test document.
- Verify published origin, Microsoft email sender/configuration, published email templates, private storage and current approved Wise destination. Verify the two job APIs used by the published frontend work before starting; this audit observed 404 responses for `/api/jobs/search` and `/api/jobs/:id`, while `/api/health` and the sitemap responded. This was not changed or diagnosed as part of onboarding.
- **No-money limit:** fake proofs must never be independently verified in production. The full positive verify → agreement → Active path requires authentic independently checked settled funds, or an explicitly isolated staging/sandbox with synthetic settlement. The ordinary published runtime has no approved no-money settlement bypass. A production no-money run must stop at pending/rejected proof; do not attest to a fabricated Wise receipt. Complete downstream positive steps in isolated staging until an authorized genuine settlement test is approved.

For each email, save actual external-inbox delivery evidence (recipient role, subject, timestamp, event/message ID and destination route). “Accepted by email provider” or a ledger claim alone does not prove inbox delivery. Editable published template subjects may differ from seeded defaults below.

| Step | Actor and action | Expected state / checks | Expected email and recipient |
|---|---|---|---|
| 1 | Talent applies to the approved test job. Client opens its actual submitted application. | `new`; correct Client owns it. Other Client cannot view it. | Existing application receipt to Talent if its published default receipt template is enabled; new-application companion to job-owning Client when eligible. Record actual deliveries, not assumptions. |
| 2 | Client changes application to Shortlisted through normal review. | `shortlisted`; audit retained; no Admin approval needed for the owned review transition. | Talent: seeded subject “Great news — you've been shortlisted for [job title]”. No new onboarding-specific Client/Admin email at this step. |
| 3 | Client proposes a Final interview (or completes initial rounds then proposes Final). Talent selects/accepts a slot. | Proposed → confirmed; correct time zone, meeting link, round/type and private interview details; attempt interview before shortlist on a second test application and expect `SHORTLIST_REQUIRED`. | Proposal email to Talent; confirmation email to Talent and the owning Client through the existing confirmation paths. Actual inbox delivery for both is required evidence. |
| 4 | After the genuine test interview, authorized Client/Admin records Final, Completed, Advance. | Completed Final with `advance`/`passed`; no silent conversion of another round. On second test application, try offer before this and expect `FINAL_INTERVIEW_REQUIRED`. | No new onboarding-specific email merely for recording Advance/Passed. Do not treat an offer email as an interview-outcome notification. |
| 5 | Client or Super Admin sends a formal offer with agreed positive USD rate/start date. | `offer_extended`; pending sent offer, pricing snapshot intact; duplicate pending offer rejected. | Talent: “You have a new offer — review it in your portal”. |
| 6 | Talent accepts through its own portal. | `offer_accepted`; exactly one pending security deposit and invoice. No contractor agreement yet. Refresh/double-click/replay acceptance: no duplicate debt. | Client: “[Talent] accepted your offer for [job] — deposit invoice ready”. Talent: “You accepted the offer for [job]”. **No signing-first acceptance email.** |
| 7 | Client opens deposit invoice/payment page. | Correct active approved Wise QR/instructions or explicit unavailable-destination state. Invoice snapshot remains bound to its issued configuration. Talent cannot access Client invoice totals/payment route. | No additional email merely from opening the invoice. |
| 8 | Client uploads a clearly labeled test proof and reference. No transfer is made for a no-money run. | Proof is verification-pending, deposit remains pending, application not Hired. Verify receipt is private: another Client, anonymous browser and Talent cannot read it. | Super Admins: “Payment submitted for verification” email plus Admin payment-review alert with test Client, job, amount/reference and review link. |
| 9 | Check the Client inbox immediately after proof submission. | Client sees pending verification; receipt is not payment confirmation. | Client: “We've received your payment submission”, including “Validation can take up to 24 hours. We'll email you once it's confirmed.” This is an immediate acknowledgement, **not a scheduled email 24 hours later**. |
| 10 | Super Admin rejects the intentionally unverified proof with a clear test reason; Client resubmits. | Rejection retained; new proof revision pending; no held funds or activation. Limited Admin/Client attempts to verify/reject must fail. | Client on rejection: “Please resubmit your payment proof”. On resubmission, Client acknowledgement and Super Admin review email/alert recur for that submission without duplicate retries. **A published no-money run stops here.** |
| 11 | Only with authentic independent settlement evidence (or isolated staging): Super Admin checks actual recipient, currency, amount, settlement reference/date and verification attestation, then verifies. | Deposit becomes `held`. Receipt upload alone never did this. Payment page/audit records evidence. Still not Hired. | Super Admins: “Payment verified — prepare agreement for [Talent] / [job]”. Client: “Please review and sign the OnSpot Master Services Agreement” if no current signature; otherwise no redundant MSA request. If no current MSA exists, Super Admins get “Activation blocked — approved current MSA missing”. |
| 12 | Super Admin opens prepared draft, uploads approved private Contractor Agreement PDF, reviews exact document/hash and sends it. | A draft may be prepared after verification; no automatic fabricated legal PDF. Send requires review, freezes document/attachments and moves application to `contract_sent`. | Existing contract delivery sends “Review your OnSpot contract” to Talent, the owning Client, preparing Admin and Admin accounts (and active Organization owners where applicable). A delivery recipient is not necessarily a required signer: this agreement still requires Talent + OnSpot. No sensitive PDF attachment. Contract preparation without Send does not itself send the signature request. |
| 13 | Talent reads that private PDF and signs using its own legal-name/consent controls. OnSpot authorized signer reads and signs separately. | Required parties and immutable signatures/document hash recorded. If MSA missing, remain blocked, not Hired. Wrong account cannot sign for another party. | Existing contract-delivery updates use “Review your OnSpot contract” for the signer delivery events. No Active email until all activation prerequisites hold. |
| 14 | Client follows its MSA request, reads current private PDF, enters authorized signer name and consent, and signs. | Server-bound Client identity/email/IP/user agent/version/hash/signature time recorded. Invitation checkbox alone cannot satisfy this. If MSA was already signed for current version, reuse it instead of forging another signature. | No separate new MSA-success email is required; if this is the final missing condition, activation emails in step 15 follow. |
| 15 | Observe final activation after the last required condition. Refresh/retry final actions. | `hired` (Active UI), billing activation timestamp once, agreed start date unchanged, one activation event; all three conditions satisfied. Repeating does not duplicate debts/events. | Client: “Your engagement with [Talent] is now active”. Talent: “Your engagement for [job] is now active”, plus the existing published Talent Hired companion when configured; the legacy Hired bell is reused, not duplicated. Admins have the preparation/review audit, not a promised additional Active email. |
| 16 | Repeat offer response variants using separate test applications. | Talent-counter accepted by Client; Client-counter accepted by Talent; expired→renewed→accepted; Super Admin-created offer→accepted. Every fresh acceptance is invoice-first. Historical pre-cutover accepted records remain untouched unless they receive a genuinely new acceptance. | Final acceptance uses the same Client invoice/Talent acceptance confirmations, never “Next: sign the contract.” Check retry deduplication in actual inboxes. |

### Release readiness checklist

- [x] Production inventory queried read-only and correlated with published public record IDs.
- [x] Fresh-acceptance invoice-first regression cases pass, including legacy-cohort inputs.
- [x] Production status vocabulary retained in migration 0044.
- [x] Both migrations replayed twice against copied public base schema; exact existing deposit preserved; transaction rollback rehearsed.
- [x] Dashboard MSA warning implemented, with explicit error handling.
- [ ] Refresh inventory and review the three Final-interview blockers immediately before release.
- [ ] Approve freeze/backup/release and recovery procedure; no production migration has been performed.
- [ ] Confirm current legal MSA, Contractor Agreement, authorized signer and production storage.
- [ ] Investigate/clear published job API 404s before account UAT.
- [ ] Run real signed-in Client/Talent/Super Admin/limited-Admin UAT; capture private-access failures and actual inbox deliveries.
- [ ] Keep no-money production proofs unverified. Approve an isolated staging settlement exercise or a genuine settlement test before claiming downstream production activation passed.
- [ ] Verify any external storage smoke test separately; isolated blob doubles do not prove object persistence.

**Verification distinction:** native SQL/route-callback tests and isolated render tests are automated development evidence. No actual production/development account login, real external-inbox delivery, private production blob round-trip or independent Wise settlement was performed in this audit.

### Completed automated checks

| Check | Result |
|---|---|
| `node scripts/test-hiring-payments-isolated.mjs --onboarding-only` | 11 passed, including 5 fresh acceptance variants |
| `node scripts/test-hiring-payments-isolated.mjs --hiring-flow-only` | 11 passed |
| `node scripts/test-hiring-payments-isolated.mjs --contract-documents-only` | 15 passed, 1 optional actual storage probe skipped |
| `npx vitest run --config vitest.unit.config.mts client/src/components/AdminMsaWarning.test.tsx client/src/lib/contractorOnboarding.test.ts` | 5 passed |
| `npx tsc --noEmit` | Passed |
| Production schema-copy migration rehearsal | Both passes and transaction rollback passed |
| Development workflow restart / unauthenticated screenshot | Running; auth left intact, signed-in dashboard not visually verified |
