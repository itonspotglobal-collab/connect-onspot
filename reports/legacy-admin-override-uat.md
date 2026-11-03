# Legacy Admin hiring overrides — development verification

## Scope and outcome

The normal formal-hiring predicate and Client/Talent hiring routes were not changed. A separate Admin eligibility predicate now permits legacy metadata, while still requiring an open application, an existing linked Talent user, and a job owned by the application's Client.

No publication, production queries, production changes, or new database migration were performed.

## Read-only development diagnosis, before edits

18 applications outside rejected/withdrawn/declined failed the normal predicate.

| Failed condition | Count |
| --- | ---: |
| Talent ID missing | 16 |
| Linked user exists but does not have role Talent | 1 |
| Registration status is not `linked` | 14 |
| Job approval status is not `approved` | 1 |
| Workflow type outside permitted values | 0 |
| Initiator not Talent where required | 0 |
| Talent ID references a nonexistent user | 0 |
| Missing job | 0 |
| Job/submission Client mismatch | 0 |
| Search-scaffold or missing job origin | 0 |
| Invalid job owner account | 0 |
| Draft or missing job status | 0 |

Counts overlap. Every listed row has workflow type `application` and initiator `talent`.

| Application ID | Job title | Status | Registration status | Failed conditions |
| --- | --- | --- | --- | --- |
| 0ddde051-5b59-4d79-ad18-59f040b78097 | IT Administrator | new | pending_account | Registration status; Talent ID missing |
| 106b607b-4770-499d-91d9-07af7e5a02a0 | IT Administrator | new | pending_login | Registration status; Talent ID missing |
| 12cded3b-9f8b-4f64-a2a9-339ef5dc1bc3 | IT Administrator | new | pending_account | Registration status; Talent ID missing |
| 321becac-4d77-4494-8e7c-7d68baeab225 | IT Administrator | new | pending_account | Registration status; Talent ID missing |
| 36a86513-0bb7-4c34-9bc9-4e0a803ac77c | Accounting Manager | new | linked | Talent ID missing |
| 42c516f5-450b-40ba-9925-f2e9dd9e5ed6 | IT Administrator | new | registered | Registration status; Talent ID missing |
| 4f77159a-969f-49b3-8127-48cc31017cf6 | IT Administrator | new | registered | Registration status; Talent ID missing |
| 670029c0-219e-4108-9e31-388b251c202c | Accounting Manager | new | pending_account | Registration status; Talent ID missing |
| 8f3c3d02-112b-463b-9f08-5de0558c2408 | IT Administrator | new | registered | Registration status; Talent ID missing |
| 904a98f5-8a3c-4064-bb42-5e83cee10b5b | IT Administrator | new | registered | Registration status; Talent ID missing |
| a327b344-233c-4b44-95fa-9467995152b6 | Accounting Manager | new | registered | Registration status; Talent ID missing |
| d4b7d1a2-459b-421b-bba7-8a5466dbbbb9 | Customer Service Representative | new | linked | Talent ID missing |
| e836582a-fd20-485a-aeba-fc3390ebab50 | Customer Service Representative | new | linked | Talent ID missing |
| ebb544de-132c-49a9-9845-4e068adcb818 | Virtual Assistant | new | pending_account | Registration status; Talent ID missing |
| efb0faa3-d019-4d13-af87-61b8d0c4429f | Testing Job Kime | shortlisted | linked | Job approval is pending |
| f5d9e058-b62a-45b6-8122-627e065daecc | IT Administrator | new | pending_account | Registration status; Talent ID missing |
| f7e20ef0-b2ee-4e01-8902-4ca3a829b808 | IT Administrator | shortlisted | pending_login | Registration status; Talent ID missing |
| f94fcc4a-97b4-4e08-97d3-24d1ce1cc485 | IT Administrator | new | registered | Registration status; linked user is not Talent |

Only the Testing Job Kime application satisfies the owner's minimum Admin-override eligibility. No accounts or account links were fabricated to make the other records hireable.

## Real development-row rehearsals

Used the owner's explicitly approved USD 10 rate and 2026-11-04 start date. Called the canonical service against the existing development application and actual database guards.

Each rehearsal ran inside an outer transaction. Service transaction boundaries were contained in savepoints, and the outer transaction was rolled back after assertions. No hiring data or audit rows from these rehearsals remain committed; no outbox event became visible to notification workers. This is not signed-in browser or HTTP authentication UAT.

| Path on application efb0faa3-d019-4d13-af87-61b8d0c4429f | Observed status before rollback | Deposit | New audit rows before rollback | Normal Client guard |
| --- | --- | --- | ---: | --- |
| Hire now | hired | Waived | 1 | Denied |
| Skip stage to Offer accepted → waive deposit → Skip agreements | hired | Waived | 3 | Denied |
| Skip stage to Contract sent → waive deposit → Skip agreements | hired | Waived | 3 | Denied |

All paths had a billing activation timestamp, no held-funds timestamp, and no fabricated OnSpot or Talent signature timestamps. After rollback, the application remained `shortlisted`, and all test-created offers, deposits, contracts, events and audit rows were absent.

For each of the 17 account-link failures, tested Skip stage/Hire now, Waive deposit and Skip agreements: all 51 attempts returned `TALENT_ACCOUNT_REQUIRED`, created no audit rows, and remained denied by the normal Client guard. Missing-account cases identify the need to sign up/link first; wrong-role cases identify that the linked account is not Talent. Registration-status-only failures cannot be exercised independently on these real rows because all such rows also lack a valid Talent account.

## Isolated and mocked coverage

- 11 owned-PostgreSQL override tests passed. The parameterized legacy test exercises workflow type, initiator, registration status, approval, draft status and scaffold origin through both Hire now and staged agreement bypass.
- 18 owned-PostgreSQL onboarding tests and 5 interview workflow tests passed. The private-document/signature flow uses a legacy registration status, checks Admin preparation before/after an audit, rejects Client/Talent preparation, rejects a reverted audit, and activates only after genuine fixture signatures/MSA.
- 22 mocked browser tests passed, including readable server errors and an internal job-editor link for missing billing classification. These use synthetic auth/API fixtures, not actual signed-in accounts.
- TypeScript checking and production build passed.
- Development workflow restarted and preview checked. Actual signed-in Admin browser UI was not verified.

## Implementation pointers

- `shared/adminOverrideEligibilitySql.ts`: separate minimum eligibility and persisted-audit eligibility.
- `server/services/adminHiringOverrideService.ts`: database-confirmed Admin authorization, specific rejection reasons, billing classification editor details.
- `server/routes/adminHiringOverrides.ts`: structured error details.
- `server/services/contractDocumentService.ts` and `server/services/hiringContractService.ts`: Admin-only downstream preparation fallback requiring an unreverted override and current minimum eligibility.
- `client/src/components/admin-hiring-overrides/OverrideControls.tsx`: clear messages and restricted internal job-editor links.
- `scripts/verify-legacy-admin-overrides.ts`: development-only rollback rehearsal.

The inspected deposit issuance, paid-agreement orchestration, activation, onboarding status and database activation guards do not independently apply the formal predicate. The two agreement preparation checks did and were adjusted as described. Existing financial, signature, MSA, payment-verification and activation safeguards remain in force unless explicitly bypassed by an audited Admin action.

## Remaining limits

- No committed hire was made on the existing development application; the successful real-record tests were rolled back intentionally.
- No approved signed-in Admin/Client/Talent session was used. Authentication and UI claims are limited to the explicitly identified fixtures.
- The 17 account-link failures require legitimate account linking before hiring; they cannot be made `hired` while satisfying the owner's minimum policy.
- Conditions absent from development were exercised with disposable records, not falsely described as real development cases.
