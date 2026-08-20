---
name: Client↔talent messaging gate
description: Authorization model and concurrency rules for the in-platform messaging feature.
---

# Client↔talent messaging gate

**Rule:** The generic client↔talent thread-creation route remains invitation-only: it must validate `initiated_by = 'client'` plus an explicit accepted-status allowlist against `job_submissions`. The one deliberate exception is the application-scoped bridge: either canonical participant may open a conversation for their own eligible application. That bridge derives both participants and job context from the exact submission, reuses an existing job/direct thread, and locks the pair/job during creation.

**Why:** Clients receive talent `userId`s in search results pre-invite, so weakening the generic route would unmask talent names via the inbox before consent. Application cards/tables need a safe way to continue an established hiring conversation, but that access must be bound to the owned submission rather than caller-supplied participant IDs.

**How to apply:** For a new relationship-level surface (threads, calls, calendar invites), keep the accepted-invitation gate. For a submission-specific action, authenticate the actor, confirm Client job ownership or Talent application ownership, use a positive eligibility status list for new threads, and derive canonical user IDs server-side (including legacy email linkage). State transitions like invited→submitted remain conditional UPDATEs inside the same transaction as dependent inserts, with an advisory lock per pair/job to prevent duplicates. Names in messaging payloads must never fall back to email (contact info stays hidden).

Also: the node test runner needs `--test-concurrency=1` in this repo — parallel test files against the shared DB caused worker deserialization failures.
