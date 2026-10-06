# OnSpot private contract acceptance/signing — implementation report

## 1. Existing architecture found

The canonical hiring sequence uses the original `job_submissions` record, accepted `offers`, and `hiring_contracts`. The existing contract service atomically sets the application to Hired, activates billing and creates its pending security deposit. Existing OnSpot/Talent timestamps were acceptance flags, not document-bound signature evidence. Private Replit object storage, JWT and Talent JWT authentication, organization owner/member roles, notifications and Microsoft Graph mail already existed.

## 2. Existing functionality reused

- Existing accepted-offer snapshots, USD rules, engagement type and start-date validation.
- Canonical contract creation/voiding and signed-contract → Hired/billing/deposit activation.
- Original organic Find Work or Client invitation submission ID.
- Existing verified JWT/Talent JWT middleware and mutation rate limiter.
- Existing private object provider, Graph `sendApplicantEmail`, notification records, bell routing and unread-count allow-lists.
- Existing Client, Admin and Talent application surfaces, account menus and styling.

## 3. Root gaps discovered

Previously contracts could be created without a real PDF, using arbitrary document references. Timestamp signing did not require reviewing exact bytes, a typed legal name, consent, a version/hash or authenticated representative evidence. Partial signing did not prevent later document replacement. There was no Client/Organization signature requirement, private contract-specific PDF authorization, immutable signature history or executed PDF audit copy.

## 4. Files changed

**Server:** `server/contractDocumentRoutes.ts`; `server/services/contractDocumentService.ts`; `contractBlobStore.ts`; `contractDeliveryService.ts`; existing `hiringContractService.ts`; `server/routes.ts`; `server/objectStorage.ts`.

**Schema/migration:** `shared/schema.ts`; `migrations/0035_private_contract_documents.sql`.

**UI:** `client/src/components/ContractWorkflow.tsx`; `ContractApplicationPanel.tsx`; existing `AdminJobApplications.tsx`, `ClientProfile.tsx`, `TalentApplications.tsx`, `App.tsx`, `ClientLayout.tsx`, `TopNavigation.tsx`, `NotificationBell.tsx`; `client/src/lib/notificationRouting.ts`.

**Verification/dependency:** `server/tests/contract-documents.fixture.ts`; `scripts/verify-hiring-flow.ts`; `package.json` and lockfile add `pdf-lib`. Signing policy and disposable schema-generation lessons are recorded in project memory.

## 5. Migration

`0035_private_contract_documents.sql` additively extends canonical contracts with party type, optional organization, preparer, title/message and document-managed flag. Related tables store immutable PDF versions, reviewed-version receipts, attributed signatures, timeline events and email-delivery outcomes. Constraints/indexes enforce versions, hashes, one current PDF and one signature per required role.

The development application was restarted through its existing migration workflow. A read-only check confirmed the migration ledger entry, document/signature tables, executed digest column and countersigned constraint. Production was not migrated or republished during this work; migration must be applied through the established production rollout before the new feature is used there.

## 6. Endpoints

All `/api/contracts` endpoints require the existing verified authentication middleware:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/contracts` | Authorized contract list |
| GET | `/api/contracts/accepted-offers` | Eligible owned/authorized offers, including Org owner starter flow |
| GET | `/api/contracts/context?offerId=...` | Canonical offer/party context and allowed organizations |
| POST | `/api/contracts` | Prepare canonical draft |
| GET | `/api/contracts/:id` | Safe details, signatures, timeline and capabilities |
| PUT | `/api/contracts/:id/document` | Multipart PDF upload/replacement, draft only |
| GET | `/api/contracts/:id/pdf` | Authorized original bytes and reviewed-version receipt |
| GET | `/api/contracts/:id/pdf?executed=true` | Authorized executed audit copy |
| POST | `/api/contracts/:id/send` | Freeze reviewed version and request signatures |
| POST | `/api/contracts/:id/sign` | Version-bound name/consent signature |
| POST | `/api/contracts/:id/void` | Authorized void and canonical rollback |
| POST | `/api/contracts/:id/decline` | Talent decline before execution |
| POST | `/api/contracts/:id/resend-emails` | Authorized manager retry |

Legacy create/edit/sign/void mutation endpoints now direct callers to the private PDF workflow instead of accepting timestamp-only signing or document references. Their existing role checks remain. Generic object routes/storage lookup cannot serve contract namespace objects, even with a guessed key.

## 7. State machine

Draft → sent_for_signature → talent_signed → countersigned → executed, with signature-order flexibility retained from the existing service. A partial countersign never substitutes for another required signer. Some intermediate states occur in the same final signing transaction.

Draft PDF replacement creates a new immutable version and marks the previous draft superseded. Sent or signed PDFs cannot be replaced. Void/decline retains evidence, returns only an eligible application from contract_sent to offer_accepted and allows a fresh canonical contract. Executed contracts cannot be voided through this flow.

## 8. Signing authorization

- **OnSpot agreement:** Talent + authenticated OnSpot Admin.
- **Client agreement:** Talent + owning Client + authenticated OnSpot Admin.
- **Organization agreement:** Talent + authorized Organization owner + authenticated OnSpot Admin.

OnSpot remains mandatory, as confirmed. A Client can never sign the OnSpot role. Server-derived roles, parties and authority govern every operation; caller-provided role, Talent ID, signed boolean, date or storage key is not signing evidence. Talent-token resolution must lead to a canonical Talent account, never a Client/Admin account.

Talent must fetch the exact current PDF and explicitly supply a legal name with unchecked-by-default consent. A prior-version receipt/hash cannot authorize a current-version signature. Sensitive IP-hash/user-agent audit metadata is stored but not returned in ordinary UI responses.

## 9. Organization rules

Existing active `owner` membership provides contract authority. Ordinary members do not acquire signing authority and cannot browse other members' contract documents. The original job-owning Client remains a relevant read-only party when not an Organization owner.

The hiring Client must be an active member of the selected same Organization. Foreign, suspended or deletion-pending organizations/members cannot establish authority. The actual representative user ID, Organization ID, role and authority context are retained; no signature is attributed only to a company name.

## 10. Private PDF storage

PDFs are uploaded server-side into a dedicated private object namespace, with unique keys and create-only storage preconditions. Clients receive no reusable PUT URL, public URL or raw storage reference. ACL/storage failure is not treated as a successful upload. The stored bytes are read back and checked before recording success.

Validation requires a readable, non-empty `.pdf`, `application/pdf`, maximum 10 MB and 1–300 pages. Password-protected/invalid PDFs and active scripts, embedded files/form actions are rejected. Filenames are sanitized. Authorization is checked before upload parsing and again inside the mutation transaction. Served bytes use private/no-store caching.

An actual private-provider PDF save/read/hash/delete round trip passed. Its blank synthetic fixture PDF was deleted afterward.

## 11. Hashing and versions

SHA-256 is computed over exact unchanged original bytes. Every signature stores document ID, version and hash together with its authenticated user, server role, typed name, method and time. Replacement never transfers signatures or reviewed receipts.

Viewing, sending and signing verify stored bytes against their recorded digest. Tampering refuses the operation. The separately generated executed PDF adds a signature audit page; its own digest is stored/checked and its original source remains unchanged.

## 12. Email and notifications

Sent, signed, countersign-required, executed, voided and declined events create authenticated in-app contract links and delivery-ledger entries. The bell/unread role allow-lists include contract events. Notifications resolve to the authorized Contracts page, not raw PDF objects.

Graph emails link to authenticated review, with no sensitive attachment. Provider acceptance is explicitly distinguished from inbox delivery. Failed/skipped sends remain truthful and retryable; accepted event/recipient sends are not repeated. Retry never duplicates a contract, signature, notification or deposit. No live inbox receipt was claimed.

## 13. Hired activation

The document transaction locks the canonical contract and original submission. Only after all required, hash/version-matching signatures exist does it invoke the existing canonical contract updater in that same transaction. This preserves the original contract_sent → Hired history, `billing_activated_at` and single pending `security_deposits` record.

Hired notifications are dispatched only after commit. Signing alone, partial countersigning, decline, failed/tampered bytes and replacement attempts cannot activate billing. No new parallel Hired writer or duplicate invitation was added.

## 14. Automated verification

**PASS — 14 contract checks:** real disposable PostgreSQL and production contract/document services; the external transport boundary is simulated for business tests, plus an actual private-storage round trip. Coverage includes both entry paths for all three party types, mandatory OnSpot/third-party signatures, original bytes, executed copy, unrelated users/organizations, ordinary/suspended members, review/consent, immutable versions, legacy-sign bypass, hash tampering, decline, delivery failure/retry and concurrent final signing with exactly one deposit.

**PASS — 10 existing hiring-flow regressions:** native invitation and organic application pipelines, real interview/offer/acceptance services, ownership/eligibility and Graph failure/retry behavior.

**PASS — TypeScript check.**

**PASS — 12 unauthenticated Admin job endpoint probes**, after the running application was available.

Live contract list/accepted-offer/PDF probes returned 401 without authentication. Generic contract object lookup returned 404. The `/contracts` screenshot displayed the real sign-in gate, not a bypassed private screen.

These checks are not a claim that the signed-in browser UAT below was performed.

## 15. Manual UAT results

| # | Requested check | Result |
|---|---|---|
| 1 | Complete real offer | PENDING |
| 2 | Accept offer as Talent | PENDING |
| 3 | Open Prepare Contract | PENDING |
| 4 | Upload a real test PDF | PENDING |
| 5 | Send contract | PENDING |
| 6 | Log in as Talent | PENDING |
| 7 | Receive notification | PENDING |
| 8 | Receive contract email where configured | PENDING |
| 9 | Open PDF | PENDING |
| 10 | Sign contract | PENDING |
| 11 | Log in as authorized Client/Admin/Organization signer | PENDING |
| 12 | Countersign, including mandatory OnSpot | PENDING |
| 13 | Confirm fully executed status | PENDING |
| 14 | Confirm application becomes Hired | PENDING |
| 15 | Confirm appropriate Client/Talent/Admin views | PENDING |
| 16 | Confirm unauthorized account cannot retrieve PDF | PENDING |
| 17 | Confirm signed PDF/version cannot be replaced | PENDING |

No real signed-in accounts or inboxes were used to claim these manual steps. The public sign-in screenshot cannot verify the private UI.

## 16. Remaining limitations

- This is **OnSpot's in-system contract acceptance/signing**, not DocuSign, Adobe Sign or a qualified external signature provider/certificate. Typed consent does not independently prove legal identity.
- Signed-in browser UAT, actual inbox receipt and production rollout remain pending.
- Unsigned legacy timestamp-only contracts require void/reissue for fresh version-bound evidence. Historical signed rows are not silently converted or given fabricated PDF evidence.
- The audit-page copy currently uses a standard Latin font; non-Latin characters are replaced with `?` in that copy. Exact Unicode names remain in authoritative signature records/UI, and the unchanged original PDF is retained. Legal-name input currently requires at least three characters.
- PDFs are structurally validated, not independently antivirus-certified.
- Email retry is explicit through the authorized manager action; no new background retry scheduler was added.
- Contract lists return up to 500 authorized records; eligible-offer starters return up to 100. Pagination is not added.
