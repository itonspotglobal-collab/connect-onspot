# Client application status emails

## Current policy

Clients directly update eligible review statuses for genuine applications to jobs
they own. Admin approval and a Client email composer are not required. This
supersedes the previous Client status-request policy.

The existing `PATCH /api/client/job-submissions/:id/status` delegates to the same
status-with-email handler used by the Admin email endpoint. There is no second
canonical application state or separate status table.

### Status-to-template mapping

| Canonical status | Existing applicant template stage | Stock default name |
| --- | --- | --- |
| `under_review` | `under_review` | Application Under Review |
| `reviewed` | `under_review` | Application Under Review |
| `shortlisted` | `shortlisted` | Applicant Shortlisted |
| `rejected` | `rejected` | Application Not Progressing |

Reviewed retains its canonical value and shares the Under Review template,
consistent with the existing Talent-facing display alias. Selection requires
exactly one published, non-archived default for the mapped stage. Customized
Admin-managed content is used without reseeding or overwriting it. Missing,
unpublished, ambiguous, empty or unresolved templates block sending and status
updates. There is no arbitrary-template fallback.

Variable resolution, HTML sanitization, link canonicalization, Graph transport,
and the existing status-email sender (`careers@onspotglobal.com`) are retained.
Graph acceptance means the provider accepted a send request; it is not proof of
inbox delivery. No mailbox delivery or independent provider verification is
asserted by automated tests.

## Permissions and workflow boundaries

- `authenticateJWT` and `requireClient` protect the mutation.
- The authoritative owner is `jobs.client_id`, not a stale duplicated submission
  owner or caller-supplied participant/recipient.
- Genuine Talent-initiated `application` records and accepted
  `client_invitation` records are eligible. `client_shortlist` is excluded.
- Normal review sources are Submitted/new, Under Review, Reviewed, Shortlisted.
  An interviewing application may be rejected but cannot be reset to a generic
  review status. Pending/declined invitations, terminal states and offer/contract
  states cannot be repurposed through the generic selector.
- The server alone selects the recipient, template, content and sender.
  Client responses contain only success/email state, canonical status and source
  version. Existing list/detail contact masking remains in force.
- Interview, offer, acceptance, signature-driven Hired, withdrawal, verification,
  job-post approval and financial approvals are not replaced or weakened.

## Consistency and retry protocol

The Client sends `status`, `expectedStatus`, an exact database `expectedVersion`,
and a UUID `operationId`. Both the UI and server guard repeated submissions.

1. Acquire the existing application status-email advisory transaction lock.
   Admin send and manual-retry operations use this same lock namespace.
2. Lock the application using `FOR NO KEY UPDATE`, validate actual job ownership
   under a shared job lock, workflow and source version. A completed operation is
   a replay, not permission to overwrite a newer status.
3. Render the correct existing template. Before contacting Graph, create a
   durable `sending` entry in the existing `job_application_emails` ledger.
4. Independently persist the provider outcome and append attempt evidence.
   This survives a rollback of the application transaction.
5. After known acceptance, update the canonical application, history, Talent
   notification, Admin activity notification, completed ledger marker and
   superseded pending requests in the application transaction.
6. Commit once. Notifications use the immutable status-history event identity.

The independently bounded ledger connection pool prevents ordinary pool
exhaustion while concurrent application transactions wait for locks. Notification
recipient lookups in the Client transaction use its existing connection.

### Failure behavior

- **Known provider rejection/token failure:** status remains unchanged; a retry
  through the owning Client action can send again. Previous failed attempts
  remain in the ledger's append-only attempt array.
- **Provider accepted, subsequent status/history/notification write fails:** the
  ledger remains `sent`, incomplete. Retrying the original transition, including
  after a reload with a new request UUID, finalizes without another email.
- **Ambiguous network/provider outcome or failed sent-evidence write:** a durable
  `sending`/`delivery_unknown` marker blocks automatic resend. An Admin must obtain
  independent provider evidence; the UI never claims the email was sent.
  There is no automatic reconciliation with the Microsoft mailbox in this change.
- **Stale version, including an ABA status cycle:** reject without sending.
- **Already-current status:** no status history or email is generated.
- **Conflicting pending delivery:** block another target and Admin status email
  until the original delivery is reconciled.

Manual Admin email retries do not accept automatic Client ledger records.
The Admin email-history panel displays automatic delivery/finalization state
and attempt evidence rather than exposing an unsafe generic Retry button.

## Historical approvals

New approval creation and old approval-send actions return HTTP 410.
Historical data is not deleted.

Unsent historical requests can be archived (cancelled) without an applicant
status change or a misleading rejection alert. A successful direct update
atomically cancels its superseded pending requests. An already-delivered legacy
approval must first use the retained Admin finalization path; this path still
checks its saved source status and sends no email. Cancelled/stale requests
cannot subsequently overwrite a direct update.

## Migration and release

`migrations/0042_client_application_status_email.sql` adds three columns to the
existing email ledger: source version, completed-at and attempt evidence.
It is additive, backward compatible for legacy rows and idempotent.
It does not delete or mass-transition pending requests.

The normal versioned migration runner must apply it before serving the changed
API. Do not run a manual production migration merely to verify development.
No production publish or production migration was performed for this change.

Before publishing, verify that each mapped stage has exactly one usable published
default, the configured Graph sender remains authorized, and approved test
recipients receive the correct customized content and working sign-in/deep links.

## Verification

Run:

```sh
npx tsc --noEmit
npm run build
node scripts/test-hiring-payments-isolated.mjs --client-status-only
```

The isolated harness creates and removes its own native PostgreSQL database,
scrubs application/provider credentials and denies unrelated services.

- Registered production routes, normal password-authenticated Client/Talent/Admin
  test accounts, real compiled Client UI, real persistence and real notification
  code are exercised.
- Microsoft OAuth and Graph HTTP responses are simulated. No external email,
  existing customer records or production database is used.
- Scenarios include all four mappings, desktop/mobile Client UI success and
  failure/retry, Talent application visibility, Admin history, ownership/privacy,
  dedicated-stage guards, silent-shortlist exclusion, duplicate/concurrent
  requests, exact stale versions, known rejection, unknown outcome, post-send
  database failures, reload recovery, connection-pool saturation, manual Admin
  email compatibility, historical recovery/archive and migration idempotency.
- Existing applicant-template and variable-resolution/sanitization suites run
  alongside the end-to-end fixture.

Development verification on 2026-10-21: 16 authenticated-route/browser scenarios,
6 template tests and 7 variable-resolution tests passed (29 total). TypeScript
and the four-stage production build passed. The development ledger's three
columns and independently connected query pool were checked read-only.
All 12 unauthenticated Admin-job probes returned 401 when run with IPv4-first
DNS; the existing standalone check's default localhost resolution otherwise
reports connection failures. These are not live mailbox or production tests.

## Files changed

Runtime and UI:

- `server/routes.ts`
- `server/db.ts`
- `server/services/clientApplicationStatusEmail.ts`
- `server/services/applicationNotificationService.ts`
- `server/services/microsoftGraphEmailService.ts`
- `shared/submissionStatuses.ts`
- `shared/schema.ts`
- `migrations/0042_client_application_status_email.sql`
- `client/src/pages/ClientProfile.tsx`
- `client/src/pages/AdminJobApplications.tsx`
- `client/src/components/ApplicantEmailComposer.tsx`

Tests and documentation:

- `server/tests/client-application-status.fixture.ts`
- `server/tests/fixtures/hiring-db.ts`
- `scripts/test-hiring-payments-isolated.mjs`
- `docs/AS_BUILT_JOURNEY_MAPS.md`
- `docs/CLIENT_APPLICATION_STATUS_EMAIL.md`
- Relevant Client-status, retry and shortlist notes in `.agents/memory/`.
