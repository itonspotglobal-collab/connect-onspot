---
name: Status email retry invariant
description: Durable rules for applicant email retries that are coupled to application status changes.
---

Failed applicant emails intended to change status must retain the requested/previous status and source version. Manual Admin emails retain their Admin-only retry gate. Automatic Client status emails retry only through the owning Client's version-checked status action, never the manual resend endpoint. Both paths serialize against the same application email lock.

**Why:** An email-history retry that only resends the message can tell a Talent their application changed while the canonical application still has the old status, and repeated retries can duplicate delivery.

**How to apply:** Keep dedicated hiring actions separate. For automatic Client updates, durably record delivery independently of the status transaction: known rejection permits retry; known acceptance permits finalization without resending; ambiguous outcomes block resending pending independent provider evidence. Commit history and in-app alerts together, keyed by the history event. Retain manual Admin recovery behavior. Talent-portal reads must resolve the persisted candidate/user link, never token email alone.

Delivery-ledger writes need capacity independent of transactions waiting on application locks, and notification lookups inside the atomic Client transition must use its transaction connection.

**Why:** Concurrent requests can occupy every ordinary pool connection while the lock holder waits for another connection to persist its email evidence, causing a deadlock unrelated to PostgreSQL row locking.

**How to apply:** Preserve the separately bounded ledger pool and avoid unrelated pool checkouts from inside the locked Client transition.