# Manual Wise: isolated authenticated staging UAT setup

Status: **blocked before account provisioning**. This is an inspected setup proposal, not an implemented staging environment or a passed UAT run.

## Inspection findings

- Client/Admin password login uses the application's `/api/login` handler and stored password hashes. Do not replace this with minted JWTs or the existing isolated test suite's actor-name bearer tokens.
- Supported signup is the pending email-verification service registered at `/api/signup` and `/api/signup/verify`. The older immediate signup blocks are disabled. Keep email ownership verification enabled.
- Signup's runtime mail adapter uses Microsoft Graph when explicitly enabled. Disabling it reports delivery failure; it does not create a working local verification inbox. A safe notification sink must be implemented and tested before new staging signup can complete without external delivery.
- Admin addresses must use the company domain. `/api/internal/promote-to-admin` promotes an existing eligible account and records a role audit entry, but requires a configured bootstrap secret. That secret is absent from the development secret inventory checked for this request. Do not enable it in this shared environment or use personal/production credentials to get around this prerequisite.
- `/api/admin/users/:id/sub-role` requires an authenticated Super Admin, updates the role transactionally and audits it. An admin with a null sub-role has Super Admin privileges; `client_success` and `talent_acquisition` are restricted sub-roles.
- The application database module reads `DATABASE_URL`; private file storage reads the configured private object root. Neither proves a separate staging target.
- Normal development and production launch paths can execute migrations. Do not start a copied app until its database/storage identity and external effects are checked.
- The existing Wise integration tests use disposable SQL and injected storage/authentication. They do not establish real signup/login sessions.

## Exact remaining blockers

1. No dedicated staging project origin, independently identified database or project-owned private bucket is established in this workspace.
2. No verified catch-all test inbox or fail-closed notification sink is available for supported signup. Disabling signup delivery alone prevents signup completion.
3. No authenticated staging Super Admin exists for role assignment, and the supported bootstrap mechanism is not configured here.

No personal password, production credential or authentication token is needed from the owner. The next required input is the **dedicated staging project/location**, not a credential.

Per the instruction to stop when authenticated staging sessions cannot be established, no test users, QR configurations, invoices, receipts, simulated approvals or new settlement harness were created. No production changes were made.

## Proposed account provisioning — supported mechanisms only

After establishing staging isolation:

1. Use a new staging project with separate database, private storage and freshly generated staging-only server secrets. Do not clone live user/financial data or reuse production integration credentials.
2. Install a staging-only notification sink with no external network delivery. Preserve signup ownership challenges, expiry, attempt limits and successful-delivery semantics; deliver challenges to the protected test inbox, not logs or a public API. Until this exists, do not claim notifications are safe or signup works.
3. Reserve dedicated, owner-approved company-domain test mailbox aliases for two staff accounts. Use two separate dedicated Client accounts to test cross-client isolation. Do not invent or contact company addresses without mailbox approval.
4. Create all accounts through supported signup and complete their actual verification challenges through the test inbox. Generate unique random passwords inside the private test runner; hold them only in memory for that run. Never print them, put them in reports, or commit them.
5. An authorized staging operator configures a fresh staging-only bootstrap secret through secure secret management. Promote the dedicated staff accounts through the supported internal promotion endpoint, then disable bootstrap access after setup. No role updates by raw SQL.
6. Log in the dedicated Super Admin through `/api/login`. Use the supported audited sub-role endpoint to assign the second staff account `client_success` before allowing its test session. Promotion may initially grant Super Admin power; keep that account out of browser sessions until restriction is confirmed.
7. Log in all roles through the normal portal and verify their current database roles. Keep independent browser contexts for Super Admin, restricted admin, Client A and Client B. Keep session tokens private to those contexts.

The bootstrap route's existing implementation is not a transactional account-provisioning utility. Validate its role audit result and fail closed on partial failure rather than silently continuing.

## Proposed TEST-ONLY fixtures

Only create these after the preceding account gate passes:

- Two deliberately non-payable QR images labeled `TEST ONLY — NO PAYMENT — A` and `TEST ONLY — NO PAYMENT — B`, encoding non-routable test identifiers rather than a Wise URL or bank destination.
- Recipient text such as `TEST ONLY — SIMULATED RECIPIENT A/B`; instructions explicitly say no transfer, no genuine Wise destination and no real settlement. Test currency USD means fixture denomination, not a claim that any receiving account supports it.
- Use normal Super Admin draft/review/activation operations in the isolated staging ledger. Review confirmations must concern these clearly synthetic fixtures, never claim real account ownership.
- Create disposable invoices owned by Client A and Client B, using the application's supported financial creation path and existing amount authorities. Identify their exact supported creation route during staging setup; do not seed parallel billing tables or assume a direct invoice insertion is a supported UI flow.
- Use generated receipt images marked `TEST ONLY — NO TRANSFER`. Retain fixture ownership, original QR snapshots, references and audit history throughout the run.

This request authorizes synthetic staging fixtures. It does not authorize changing or falsely approving the previously supplied official OnSpot Wise QR.

## Proposed settlement harness — not yet implemented

Do **not** add a settlement bypass endpoint or an environment-variable switch to the production app.

Implement the harness as a separate test-runner program, excluded from the production build/deployment artifact, with no import or route registration reachable from the app entry point. It should:

1. Run only in the independently provisioned staging/test execution environment with no production secrets or network access to production databases/storage, Wise, email, calendar or payment providers.
2. Fail before any write unless the expected staging origin, database identity, private storage identity and run-specific fixture ownership all match an operator-provisioned manifest. `NODE_ENV`, a request body, a hostname substring or a `TEST_MODE=true` flag is insufficient.
3. Generate clearly marked `SIMULATED-<run>-<transaction>` evidence only for that run's disposable obligations. Reject non-fixture identifiers and prevent reuse of references.
4. Use actual authenticated Super Admin requests to the existing review endpoint. Preserve production role checks, amount/currency/recipient/reference validation, locks, duplicate detection, transactional settlement and audit behavior.
5. Record that evidence is synthetic in review reasons, test records and the final report. A test may exercise the independent-evidence fields only in this segregated synthetic ledger; this never represents independent Wise confirmation.
6. Offer no simulator route or capability to browsers, Clients or restricted admins. A normal request cannot start the runner.
7. Include artifact/route reachability checks demonstrating that the production artifact contains no harness and no enabled simulation route, plus negative tests against production-mode execution, missing/wrong identity, wrong owner and non-fixture targets.

Exclusion from the production artifact and infrastructure credential/network separation are required together. A single environment flag cannot meet the requested configuration-mistake protection. Do not claim this invariant is verified before the implementation and negative checks exist.

## Authenticated execution plan and required evidence

| Journey | Evidence to capture without secrets |
|---|---|
| Login/provision | Successful normal logins; role-assignment audit; independent session contexts |
| Draft A | Upload, reload protected preview, save draft; current active version unchanged |
| Approve A | Four explicit reviews, reason, actor and activation history |
| Issue invoice A | Client A sees complete original QR and payment/reference instructions |
| Draft/approve B | Draft does not rotate active destination; explicit approval rotates new issuance |
| Snapshot | Invoice A retains A; newly issued invoice B uses B |
| Receipt lifecycle | Client submits; Super Admin rejects with reason; Client resubmits; both entries retained |
| Synthetic settlement | Harness produces marked evidence; actual Super Admin endpoint settles only the fixture once |
| Unauthorized roles | Client and restricted admin receive denial for every configuration/approval mutation; no audit/financial change |
| Cross-client isolation | Client B cannot list/read/download Client A invoices or receipts, including guessed IDs |
| Duplicates/concurrency | Competing verification and reused references cannot create a second credit or rewrite settled evidence |
| Deactivate | Server denies affected destinations; payment screens refresh to unavailable rather than invalid QR |
| Restore | Historical version becomes a new draft, still unavailable until fresh review/activation |
| Private persistence | Anonymous and cross-owner file denial; exact bytes survive authorized staging restart; no public receipt URL |
| Safety boundary | Production artifact/route absence and wrong-target runner failure verified |

Record each result as actual authenticated, simulated financial, isolated fixture, failed or blocked. Do not collapse categories into a single “passed”.

## Results for this request

- Authentication/role/database setup inspection: completed.
- Supported account method and safe harness design: documented, not executed.
- Staging isolation, notification safety, authenticated sessions, new fixtures, harness implementation and end-to-end scenarios: **blocked/not established**.
- No new authenticated tests passed; no real Wise settlement occurred.
- No deployment, migration, financial mutation, account provisioning, auth weakening or notification send performed.

See `WISE_QR_UAT_READINESS.md` for the earlier read-only preflight evidence, which is not a substitute for these remaining checks.
