---
name: Client↔talent messaging gate
description: Authorization model and concurrency rules for the in-platform messaging feature.
---

# Client↔talent messaging gate

**Rule:** A message thread between a client and a talent may only exist after the talent accepts a client-initiated invitation. Thread creation must validate `initiated_by = 'client'` plus an explicit accepted-status allowlist against `job_submissions` — never a negative status filter (ordinary talent applications also reach `submitted` and must NOT open messaging). Participants and jobId are derived server-side; callers never supply them authoritatively.

**Why:** Clients receive talent `userId`s in search results pre-invite; an ungated thread-creation endpoint would unmask talent names via the inbox before consent and bypass the identity-protection model. Code review rejected two weaker versions of this gate.

**How to apply:** Any new endpoint that creates or reveals a client↔talent relationship (threads, calls, calendar invites) must check the same accepted-invitation relationship. State transitions like invited→submitted must be conditional UPDATEs (`WHERE status='invited' RETURNING ...`) inside the same transaction as any dependent inserts, with an advisory lock per pair/job to prevent duplicate threads on concurrent accepts. Names in messaging payloads must never fall back to email (contact info stays hidden).

Also: the node test runner needs `--test-concurrency=1` in this repo — parallel test files against the shared DB caused worker deserialization failures.
