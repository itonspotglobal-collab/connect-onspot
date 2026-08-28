---
name: Messaging system
description: Durable product/security invariants for in-platform client↔talent messaging.
---

## Purpose

Clients and talent coordinate (schedule interviews, clarify requirements) in-platform without exchanging personal contact details. A thread is auto-created when a talent accepts a client invitation, and the accept response returns the thread id so the UI can navigate straight to it.

## Invariants

- **Consent gate:** a thread may only exist between a client and talent after the talent accepts a client-initiated invitation (see client-talent-messaging.md for the exact gating rules).
- **Participant-only access:** every messaging endpoint requires authentication and checks the caller is in `thread.participants`; both legacy JWTs and talent candidate JWTs are normalized to a users.id before the check.
- **Server-controlled identity:** `senderId` is always forced to the authenticated user; client-supplied sender ids are ignored.
- **No contact PII:** messages and thread metadata must never expose email/phone; display names never fall back to email. The compose UI reminds users not to share contact details.
- **Redact before persistence:** every user-authored message is deterministically sanitized before storage, notifications, or API delivery; Vanessa only sees sanitized bounded text and may add high-confidence, validated redactions.
- **Credential safety:** contextual passwords, PINs, OTPs, API keys, and tokens are fully masked and only safe detection metadata is retained; model failure must never disable deterministic protection.
- **Idempotency:** accepting again (or explicitly creating a thread) for the same client/talent/job reuses the existing thread rather than creating duplicates.
- **Unread/read source of truth:** unread counts come from incoming messages missing the viewer's persisted `readBy` entry; `new_message` notifications are a synchronized alert/deep-link, not a second unread model.
- **Delivery labels:** sent human messages are Delivered after persistence and Read only when the other canonical participant is present in `readBy`; system messages never receive either label.
