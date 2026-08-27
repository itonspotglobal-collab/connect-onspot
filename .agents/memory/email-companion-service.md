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


## Reviewed administrative notifications
Admin-reviewed decision emails must reuse the exact canonical transition event and delivery ledger as automatic companion emails. State transitions and in-app notifications remain committed even when delivery fails.

**Why:** Administrative decisions must be durable and auditable without allowing email outages or duplicate clicks to create duplicate workflow notifications.

**How to apply:** Reuse the transition event for the reviewed send, claim before sending, and record both successful and failed attempts through this service.

Admin-created jobs posted on behalf of a Client use the same reviewed composer, but their creation event is distinct from approval decisions. Resolve the recipient from the persisted job owner, never from a frontend email address. Draft saves and Client-self posts are ineligible; final submission of an Admin-owned draft is eligible.

**Why:** Creation and approval are separate business events, and tying recipient identity to persisted ownership prevents a stale or forged browser value from sending to the wrong account.

**How to apply:** Persist the job first, open the existing Client composer only after successful final submission, and use a job-specific creation event key so retries cannot duplicate a successful send.

## Privacy invariants
- Applicant contact PII (email, phone) is never included in Client-facing companion emails.
- Unread message emails never include message body content.
- Vanessa/AI is not used anywhere in the companion pipeline.

## Sender
`hiretalent@onspotglobal.com` is the default; falls back to `MICROSOFT_SENDER_EMAIL` / `APPLICATION_EMAIL_FROM` if not in the allowlist. Operational validation of Graph mailbox/Send-As permissions is still required.
