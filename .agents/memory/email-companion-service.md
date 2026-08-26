---
name: Email companion service
description: Non-blocking idempotent companion emails, including the reviewed Admin-to-Client job-decision workflow.
---

# Email Companion Service

## Rule
`server/services/emailCompanionService.ts` is the single place for all companion (notification-triggered) emails. Every function is non-throwing and idempotent. Never bypass it by calling sendApplicantEmail directly for these events.

**Why:** Business actions must never be rolled back by email failures. The delivery ledger uses an atomic claim-before-send pattern to prevent duplicate sends under concurrent retries.

## Delivery lifecycle (atomic claim)
1. `claimEmailDelivery()` → atomically INSERTs a 'processing' row (or reclaims a 'failed' retry). Returns `false` when already 'sent' or currently in-flight — caller must skip.
2. Build and send the email.
3. `markEmailDeliveryResult()` → writes final 'sent' or 'failed' status.

A stale 'processing' row (crash mid-send) is re-claimable after the configured claim-expiry window.

**How to apply:** New companion email path → add a function here, call `claimEmailDelivery` before sending, call `markEmailDeliveryResult` after.

## Reviewed job-decision emails
The Admin composer and automatic job-decision companions are coordinated through one canonical event key: `job-approval-email:${transitionEventKey}`. Reviewed content is passed into the existing companion sender; it is not sent by a separate route-level Graph call.

**Why:** A real transition must create one delivery claim and at most one Client email, while unrelated automatic companions must remain intact.

**How to apply:** Approve keeps its direct automatic path. For Unapprove and Reject, confirm first, persist the atomic transition and in-app notification, then open the composer. Manual send reuses that transition event key; closing or delivery failure never rolls back state.

## Interview emails
`sendInterviewRescheduledEmail` / `sendInterviewCancelledEmail` live in `server/services/interviewEmailService.ts` and import `claimEmailDelivery` / `markEmailDeliveryResult` from emailCompanionService.

**Admin route guard:** Rescheduled/cancelled email calls must be dispatched OUTSIDE the `if (notifType && interview.talent_id)` block so the client is notified even when no talent user is linked yet.

## DB tables (Migration 0013)
- `email_notification_deliveries` — idempotency ledger: one row per `event_key`, status `processing|sent|failed`.
- `message_email_cooldowns` — per-thread/user cooldown for unread-message emails; deleted on read.

## Coverage
| Event | Where fired |
|---|---|
| Job approved / rejected | Automatic approve/reject routes and composer-confirmed approve-with-email/reject-with-email routes |
| Client new application (auth + unauth) | routes.ts → POST /api/jobs/:jobId/apply |
| Interview rescheduled (admin-initiated) | routes.ts → PATCH /api/admin/interviews/:id |
| Interview cancelled (admin or client) | routes.ts → PATCH /api/admin/interviews/:id, PATCH /api/client/interviews/:id |
| Unread message email | routes.ts → POST /api/messages (cooldown-gated) |
| Mark-read cooldown reset | routes.ts → POST /api/message-threads/:threadId/mark-read |

## Privacy invariants
- Applicant contact PII (email, phone) is never included in Client-facing companion emails.
- Unread message emails never include message body content.
- Vanessa/AI is not used anywhere in the companion pipeline.

## Sender
`hiretalent@onspotglobal.com` is the default; falls back to `MICROSOFT_SENDER_EMAIL` / `APPLICATION_EMAIL_FROM` if not in the allowlist. Operational validation of Graph mailbox/Send-As permissions is still required.

## Test file
`server/tests/email-companion-service.test.ts` — uses `mock.module` from `node:test` (requires `--experimental-test-module-mocks`, already passed by the project's npm test runner). Single closure mock with mutable control flags (`queryShouldThrow`, `sendShouldFail`) avoids ERR_INVALID_STATE from double mock.module calls.
