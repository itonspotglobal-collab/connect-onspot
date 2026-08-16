---
name: Direct client→talent messaging (pre-invite)
description: Architecture decisions and masking rules for the pre-invite direct message feature added to HireTalentPage.
---

## Rules

**Thread creation** — `POST /api/client/message-talent` (dedicated endpoint, no acceptance gate).
- Uses `job_id = NULL`; the existing `job_submissions` row carries job context — no need to duplicate onto the thread.
- Advisory lock keyed `clientId:talentUserId:direct` for idempotency.
- Talent must have a `candidates` row (`user_id = talentUserId`); 404 otherwise.

**Name masking in thread list** — `GET /api/me/message-threads` masks talent names until an accepted client-initiated invitation exists.
- Format: `"Jane S."` (two-part name) or `"J••••"` (one-part) — consistent with `sanitizeSearchCandidate`.
- Client names are never masked (only talent participants get masked).
- The SQL query checks `job_submissions` for the accepted-invitation guard; result returned alongside `is_talent` flag; masking applied in JS after fetch.

**Graduation** — When a formal invite is accepted (talent calls `POST /api/talent/invitations/:id/respond` with `action:accept`), the acceptance flow now checks for a null-job_id thread FIRST.
- If found: reuse it (post system message there, return that threadId).
- If not found: create new null-job_id thread with system message.
- Thread `job_id` stays NULL permanently after graduation — never updated.
- System message includes job title: `"Invitation accepted — {title}. You can now coordinate…"`

**Notifications** — `POST /api/messages` fires `storage.createNotification` for all non-sender participants (fire-and-forget, errors caught). This is the platform-wide fix; applies to ALL message threads.
- `DbStorage` now overrides `createNotification`, `listNotificationsByUser`, `markNotificationAsRead` from `MemStorage` with real DB-backed versions using the `notifications` table.

**Why:**
- `DbStorage extends MemStorage` means any method not overridden in `DbStorage` runs against an in-memory Map, not the DB. Notifications were silently stored in memory and lost on restart. Three overrides were added to `DbStorage`.
- `GET /api/me/message-threads` was building `participantNames` from raw `users.first_name/last_name` with no invitation check — real name would be exposed for pre-invite threads. Masking was added to the SQL+JS layer.
- `job_id` on `message_threads` is already nullable in schema and DB (`nullable: YES`); no migration ever needed.
- The acceptance flow's old idempotency check (`AND (job_id = $3 OR ($3::text IS NULL AND job_id IS NULL))`) only matched threads whose `job_id` equalled the invitation's `job_id`. Pre-invite null-job_id threads were never found by that check — hence the separate "check for null thread first" logic.

**How to apply:**
- Any future endpoint that creates or lists message threads for clients must apply the same masking gate.
- Any future notification type should be implemented in `DbStorage`, not just `MemStorage`.
- The `job_id IS NULL` thread is the canonical pre-invite channel; do not create a second thread when an invite is accepted if one already exists.
