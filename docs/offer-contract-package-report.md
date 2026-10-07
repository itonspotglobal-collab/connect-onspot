# Offer acceptance and contract package report

Verification date: 2026-10-07. This is an implementation and automated-verification report, not a signed-in manual UAT pass.

## 1. Why Talent had no Accept/Decline action

The offer card already hid actions after its expiration deadline. That is consistent with the reported expired offer; it must not be accepted while expired. Pending offers previously offered direct responses without a terms-review and confirmation flow. They now open Review Offer and explicit Accept/Decline confirmation. Existing counteroffer behavior is retained.

## 2. Why expired offers were counted as pending

Confirmed in the previous source: the Offers section counted every `sent` row as pending, while the card separately checked its expiration date. The asynchronous expiry sweep can leave an overdue row marked `sent` until its next run. The shared deadline-aware predicate now excludes such rows immediately, keeps them visible as expired history, and refreshes time-sensitive state. Accepted offers are not retroactively marked expired.

## 3. Files changed

- `client/src/pages/TalentApplications.tsx`: review/confirmation, truthful counts and actual application history, document access.
- `client/src/pages/ClientProfile.tsx`: Client expiration renewal.
- `client/src/pages/AdminJobApplications.tsx`: authorized Admin expiration renewal.
- `client/src/pages/ClientTeamDashboard.tsx`: permanent document links matched by canonical Talent identity, not names.
- `client/src/hooks/useTalentApplications.ts`: real history and current-offer response types.
- `client/src/components/ContractWorkflow.tsx`: draft/send controls, primary removal, supporting PDFs, preparer message.
- `client/src/components/OfferExpirationRenewal.tsx`: shared renewal dialog.
- `client/src/components/talentOfferState.ts` and its test.
- `client/src/components/talentApplicationHistory.ts` and its test.
- `shared/offerState.ts`: authoritative deadline-aware offer classification.
- `shared/schema.ts`: response evidence, renewal history and attachment schema.
- `migrations/0036_offer_response_contract_package.sql`: additive database migration.
- `server/routes.ts`: ownership, atomic response evidence, renewal endpoints and authorized history/detail fields.
- `server/services/offerExpirationService.ts`: actual authorized deadline changes and audit.
- `server/services/contractDocumentService.ts`: immutable private package operations.
- `server/contractDocumentRoutes.ts`: authenticated primary-removal and attachment routes.
- `server/tests/hiring-flow.fixture.ts`, `server/tests/contract-documents.fixture.ts`: expanded native database coverage.
- This report and the existing hiring-policy memory note.

The uploaded task specification is not an application source change.

## 4. API endpoints reused or changed

Reused:

- `GET /api/talent/offers` and `GET /api/talent/offers/:id`.
- `PATCH /api/talent/offers/:id/respond` for real acceptance/decline/counter.
- Existing Client offer creation and offer-management queries.
- `GET /api/talent/applications`, now including authorized actual transition history and current-offer metadata.
- Existing Admin application detail, now including the latest offer for renewal.
- Existing `/api/contracts` list/detail, preparation, private original/executed PDF, upload, send, signature, decline/void and email-retry operations.

Added:

- `POST /api/client/offers/:id/expiration` and `/api/admin/offers/:id/expiration`, body `{expiresAt}`.
- `DELETE /api/contracts/:id/document`, draft primary removal.
- `PUT /api/contracts/:id/attachments`, one multipart PDF.
- `DELETE /api/contracts/:id/attachments/:attachmentId`, draft-only removal.
- `GET /api/contracts/:id/attachments/:attachmentId/pdf`, authorized private bytes.

No public object URL is exposed.

## 5. Offer acceptance implementation

Review displays existing persisted terms. Confirmation invokes the existing response endpoint, rather than synthesizing acceptance in the browser. Canonical candidate-to-user ownership is preferred; email fallback is limited to unlinked legacy candidates and actual Talent accounts.

The transaction locks the eligible application, requires its real offer-pending stage, and conditionally updates an unexpired `sent` offer. It records responding user, response time, accepted/declined time, and real status history. Acceptance moves the application to `offer_accepted`; decline remains declined. Replay, wrong Talent, expired and invalid-stage responses fail. Client owner response notifications remain downstream alerts, not the source of status.

Queries refresh after the real response. Application history now renders actual persisted events, not inferred completion of skipped milestones.

## 6. Expiration handling

Expired offers cannot be accepted, even before the expiry sweep runs. Client and Admin application interfaces expose authorized renewal for an expired Client/Admin proposal.

Renewal changes only the deadline on the same offer, restores its pending state, preserves all economic terms, records old/new deadlines and the actual actor, and creates a Talent offer notification. It rejects completed offers, Talent-originated counteroffers, unauthorized actors and conflicting pending offers. It does not fabricate a new acceptance or interview.

**No existing UAT offer was renewed on the owner's behalf:** the attachment did not identify the record or provide a signed-in session. Use the owning Client or authorized Admin renewal action before resuming that record.

## 7. Contract package implementation

Existing Prepare Contract remains available after actual accepted-offer eligibility. The workflow provides primary PDF selection/upload and private review, title, message, party selection, Save Draft and Send for Signature.

Supporting files are optional PDFs, up to five active files, each at most 10 MB. They have immutable object identity, version, filename, byte size and SHA-256 evidence. Primary and supporting files can be removed only while draft; removed versions remain audit history. Removing the primary disables sending until a new valid primary is uploaded.

Send verifies stored bytes, freezes supporting PDFs transactionally, and moves the canonical application to `contract_sent`. Sent primary PDFs cannot be replaced; signatures remain bound to the primary document's exact version/hash. Supporting files are clearly identified as separate from that signature hash.

## 8. Private document storage

The existing protected contract-object namespace/provider is reused. Uploads validate parsed PDF content, MIME, extension, size and active-content restrictions. Stored bytes are read back and hash-verified before success.

Reads authorize the contract relationship before retrieving an object. Supporting document IDs must belong to that same contract. Responses are private/no-store PDF bytes; object keys are not included in ordinary detail responses. Known identifiers do not grant access. There is no new public bucket or public download link.

The real private storage provider round-trip passed using a disposable fixture PDF, which was deleted afterward.

## 9. Permanent Talent document location

Existing My Applications contract cards retain Contract & Documents access into the existing authenticated `/contracts` interface. Documents are not confined to a notification or email. The existing interface retains the original, signature evidence and executed copy after execution.

No redundant new top-level Talent page was introduced.

## 10. Client/Organization document location

Client Team engagement cards link to authorized Contract & Documents records using canonical Talent IDs. OnSpot packages with no organization ID are not hidden merely because the selected organization has an ID.

Server authority remains decisive: job-owning Clients, eligible active organization owners and authorized Admins receive only permitted records. Roster membership alone grants no document permission. Draft, voided and declined records are not offered as active Team engagements. Admin application detail retains its existing contract access.

## 11. Email behavior

The existing Microsoft Graph service sends authenticated contract-review links rather than treating email delivery or attached PDFs as contract authority. Its delivery ledger distinguishes provider acceptance, failure and skipped delivery; failure can be retried without recreating contracts or signature notifications.

Automated tests exercised provider acceptance/failure through a controlled transport. **Actual inbox receipt was not tested.** A Graph accepted response must not be described as delivered to the recipient's inbox.

## 12. Signing behavior

Mandatory signature sets remain:

- OnSpot: Talent + OnSpot.
- Client: Talent + authorized Client + OnSpot.
- Organization: Talent + authorized Organization representative + OnSpot.

The authenticated expected signer reviews the stored primary and submits name/consent against its exact document ID/hash. Signer identity, authority and time are server-derived. Missing signatures never trigger Hired.

The final required signature generates the executed copy and invokes the existing canonical Hired/billing activation transaction. Concurrent/repeated requests activate once. No manual Hired, fabricated timestamps or interview bypass was introduced.

This is the existing authenticated in-system signature implementation, not a claim of a qualified third-party electronic signature.

## 13. Automated test results

Passed:

- TypeScript compilation.
- Native hiring-flow fixture: **11/11 tests**.
- Native private-contract fixture: **16/16 tests**, including actual private object-provider round-trip.
- Focused frontend state/history tests: **5/5 tests**.
- Anonymous `/api/contracts` request returned **401**.
- Running application restarted successfully; unauthenticated `/contracts` screenshot showed the expected sign-in page.

Total: **32 automated tests passed**, with no skipped tests in the final native run. Fixtures used a disposable local PostgreSQL database; no fixture hiring records were inserted into the application or production database.

Requested coverage mapping:

| Requirements | Evidence |
|---|---|
| 1–10: pending visibility/review, own acceptance, foreign rejection, decline, expiration/replay rejection, correct count and Offer Accepted | Real route handlers and database records in the offer fixture; frontend classification tests |
| 11–20: accepted-offer preparation, private upload, role access, mandatory party signatures, immutability, missing-signature safety, execution and canonical Hired | Native contract fixtures across both entry paths and all three party types |
| 21–24: later authorized reads and cross-tenant rejection | Contract detail/private PDF service assertions and scope tests; UI access links inspected and compiled |

These are automated/service checks, not signed-in browser proof of each navigation or modal.

Known unrelated observations: existing Lindy embed authorization and Stripe configuration warnings remain. Startup also reports pre-existing legacy non-USD invoice blocks. An older Admin-auth workflow showed network errors before the server was available; those were not evidence of successful authentication checks.

## 14. Manual UAT results

**All steps remain PENDING, not PASS.** The screenshot browser is unauthenticated and cannot verify signed-in Talent, Client or Admin screens. First renew the identified expired offer through the legitimate Client/Admin interface.

| Step | Required signed-in check | Result |
|---|---|---|
| 1 | Talent opens Offers | PENDING |
| 2 | Valid offer shows review/response actions | PENDING |
| 3 | Open Review Offer | PENDING |
| 4 | Verify exact persisted terms | PENDING |
| 5 | Confirm real acceptance | PENDING |
| 6 | Application becomes Offer Accepted | PENDING |
| 7 | Admin opens the same application | PENDING |
| 8 | Prepare Contract becomes available | PENDING |
| 9 | Upload test primary PDF | PENDING |
| 10 | Preview stored PDF | PENDING |
| 11 | Send for Signature | PENDING |
| 12 | Talent receives in-app notification | PENDING |
| 13 | Independently verify real inbox receipt | PENDING |
| 14 | Talent opens Contract & Documents | PENDING |
| 15 | Confirm same original PDF | PENDING |
| 16 | Talent signs | PENDING |
| 17 | Client/Organization signs when required | PENDING |
| 18 | OnSpot signs | PENDING |
| 19 | Contract fully executes | PENDING |
| 20 | Application automatically becomes Hired | PENDING |
| 21 | Talent retrieves executed copy later | PENDING |
| 22 | Authorized Client/Organization retrieves it from engagement | PENDING |
| 23 | Continue to Client Team | PENDING |
| 24 | Perform real Clock In/Out | PENDING |
| 25 | Verify resulting Timesheet | PENDING |

## 15. Pending production verification

- No publish or production migration was initiated for this request.
- Confirm additive migration 0036 and earlier private-contract migrations on the deployment database before publishing; do not assume development rollout proves production rollout.
- Run the complete signed-in checklist on the intended environment with real authorized accounts and a valid offer.
- Verify Microsoft Graph sender permissions and actual inbox receipt separately.
- Verify permanent engagement links, private PDF retrieval and actual Clock In/Out/Timesheet behavior in signed-in browser sessions.
- Existing executed audit-page rendering has limited non-Latin font support; international legal-name fidelity warrants dedicated font and regression coverage.

No new environment flags were enabled, no test-only hiring utility was added, and normal interview/signature/activation rules were preserved.
