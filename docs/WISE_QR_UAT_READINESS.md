# Wise QR authenticated UAT readiness

Assessment date: 2026-10-19. **Decision: HOLD for authenticated UAT. Not a production sign-off.**

Follow-up: `WISE_STAGING_UAT_SETUP.md` documents the inspected supported account-provisioning path, synthetic-fixture authorization and proposed production-excluded harness. The owner now permits clearly labeled TEST-ONLY QR destinations and simulated evidence in isolated staging; genuine receiving details are not prerequisites for that synthetic run. Staging isolation and supported authenticated account provisioning remain unresolved. No harness or authenticated run has been completed.

No deployment, production migration, receiving-setting write, invoice creation, receipt submission, or settlement approval was performed in this assessment. No credentials were guessed, accounts impersonated, or authentication bypasses introduced.

## Current live development evidence

- Opening `/admin/ledger` in a fresh browser rendered staff sign-in. Browser logs showed no JWT session and a redirect to `/admin/login`.
- Ten anonymous HTTP checks returned 401: configuration list, official QR preview, submissions list, protected file download, draft save, QR upload, activation, deactivation, restoration, and submission review. Mutation requests contained empty JSON and a nonexistent UUID where applicable; authentication rejected them before business operations.
- These results establish anonymous denial only. They do **not** establish authenticated Client or restricted-admin authorization.
- Read-only development database inspection found zero receiving configurations, zero active versions, and zero registered configuration QR files.
- The separately staged original private QR source was readable: 36,300 bytes, SHA-256 `d11eb23bb6b58d4f6fb3fe531969dede65ef22086a439e8f0655e7a937d5df6e`. This checks source-image persistence/integrity, not a newly uploaded configuration or a customer receipt.
- Migration `0041_manual_wise_configuration_lifecycle` is recorded in the development migration ledger as applied. Lifecycle columns, status/active consistency checks, restrictive history foreign keys, and the unique active-per-currency index exist.
- No production database was queried or migrated. Production schema and storage readiness remain unverified.

## Requested authenticated scenarios

| # | Scenario | Actual authenticated result |
|---|---|---|
| 1 | Super Admin uploads QR and saves draft | Not run: approved login and approved configuration unavailable. |
| 2 | Draft leaves active destination unchanged | Not run: no active development baseline. |
| 3 | Review recipient, currencies, instructions and QR | Not run: approved details and authenticated reviewer unavailable. |
| 4 | Activate through genuine Super Admin session | Not run; no review confirmations fabricated. |
| 5 | Eligible Client pages show active QR | Not run: approved Client access and eligible test obligations unavailable. |
| 6 | Issue invoice, replace config, retain original snapshot | Not run: requires approved first and replacement configurations and safe test invoice setup. |
| 7 | New invoice uses replacement configuration | Not run: same prerequisites as #6. |
| 8 | Reject/resubmit receipt; independently settle and mark paid | Not run. No real money is authorized, no independent Wise settlement evidence exists, and no approved test-only settlement procedure is established. Do not set independent-verification flags merely to complete UAT. |
| 9 | Emergency deactivation removes invalid destination | Not run: requires approved active test destination and payment screens. |
| 10 | Restore older config as draft and require fresh review | Not run: requires authenticated lifecycle history. |
| 11 | Clients/restricted admins cannot configure or approve | Authenticated roles not run. Anonymous denial passed, separately reported above. |
| 12 | Private receipts, image persistence, migration readiness | Partial only: original private source integrity and development migration structure/ledger passed. New upload persistence, real receipt ownership denial, staging restart behavior and production readiness remain open. |

## Existing isolated evidence — not authenticated UAT

Previously completed evidence remains available; these suites were not rerun during this read-only preflight:

- 28 backend/billing tests passed using disposable PostgreSQL and injected blob transport.
- 22 browser tests passed using actual components with fixture API responses.
- TypeScript and production build passed.
- Coverage includes draft isolation, activation review, currency handling, concurrent activation, original invoice snapshots, receipt rejection/resubmission and synthetic settlement, deactivation, restore-as-draft, permissions, protected file paths and fixture restart persistence.

Synthetic settlement in isolated tests demonstrates software behavior only. It does not establish any Wise receipt or settlement. Component fixture tests do not establish actual login, application database permissions, or real private receipt storage.

## Blockers

1. No credentials for approved UAT accounts or reusable authenticated sessions were available. Required roles: Super Admin, Client and restricted admin. Never add credentials to this document or source control.
2. Separate staging project/database/storage identity, recovery evidence and external-notification restrictions have not been established for this run. Do not treat a development label as proof of isolation or use a production/legacy database as staging.
3. No active receiving baseline exists, and the supplied original QR alone does not approve recipient, supported currencies or transfer/reference instructions. Two approved configuration versions are needed for rotation tests; do not generate a replacement payment destination.
4. No approved test obligations/receipt samples and ownership mapping have been supplied.
5. No independent Wise settlement evidence exists. With no real money, mark-paid verification must remain isolated synthetic coverage unless an explicitly approved test-only procedure permits exercising it in a demonstrably segregated staging ledger without claiming a real Wise transfer.
6. The specialized browser-testing service rejected its configured testing agent type in this session. Direct browser screenshot and HTTP preflight checks succeeded, but an interactive authenticated browser runner must be available for continuation.

## Production readiness checklist

- [x] Development migration ledger records 0041; required structure and active-currency uniqueness confirmed.
- [x] Original private source image remains byte-for-byte intact.
- [x] Anonymous settings, approval and protected-download requests denied.
- [x] Prior isolated regression/build evidence identified and separated from live UAT.
- [ ] Confirm dedicated staging identity, storage ownership, recovery and notification controls.
- [ ] Arrange secure access to approved accounts for all three roles; do not share passwords in chat.
- [ ] Approve both real QR configuration versions and associated recipient/currency/instruction details.
- [ ] Run scenarios 1–7 and 9–11 through real authenticated application sessions with disposable test records.
- [ ] Verify receipt ownership/IDOR denial, upload/download integrity and persistence after an authorized staging restart.
- [ ] Approve an honest no-money settlement test procedure or explicitly leave real independent settlement unverified.
- [ ] Review audit actors/reasons/history and ensure test records cannot be mistaken for real receivables.
- [ ] Review the intended production database target, pending migration set, backup/recovery and startup side effects without applying changes.
- [ ] Verify intended production private storage/access configuration separately; development persistence does not prove it.
- [ ] Obtain explicit approval before any production migration or deployment.

The existing launch scripts include migration execution; do not start a production process as a supposedly migration-free readiness check.
