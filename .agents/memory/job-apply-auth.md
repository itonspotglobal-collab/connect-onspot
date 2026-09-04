---
name: Job apply route and auth handling
description: Apply page route path, dual-JWT handling on the server, and useProfileResume flag for resume reuse.
---

## Route
The job apply page is at `/jobs/:jobId/apply` — NOT `/find-work/apply/`. Both the gate screen returnTo and the sign-in dialog returnTo must use this path.

## Dual JWT on the server apply endpoint
The server `/api/jobs/:jobId/apply` performs an **early auth check** before CV validation so it can decide whether `useProfileResume=true` is valid. It handles two JWT types:
- **Legacy JWT**: `{ userId }` — looks up `users` by `id`
- **Talent Portal JWT**: `{ type: "candidate", candidateId, email }` — looks up `users` by the candidate's email (LOWER match)

The early result is stored in `earlyAuthedUser`; the later `authedUser` variable is simply set to `earlyAuthedUser` (duplicate auth block was removed).

## useProfileResume flag
If the client sends `useProfileResume=true` without a `resume` file:
1. Server skips the "CV required" 400 error
2. After body parsing, server looks up `candidates.resume_url` by email, then falls back to `documents` table (type='resume', most recent)
3. If neither exists → 400 "No resume found on your Talent profile"
4. Same pattern exists for `useProfileVideo=true` → looks up `documents` (type='video_intro')

**Why:** Authenticated talent users already have a resume in their profile; forcing them to re-upload is poor UX and wastes storage.

## Application video ownership and rollback
- `useProfileVideo=true` must resolve media from the identity signed into the JWT: candidate tokens bind to `candidateId`, while legacy Talent JWTs bind to `users.id`. Never select profile media using the application form's contact email.
- A required-video job is valid only after a new upload or owned profile video resolves to a real private object path. The boolean reuse flag alone is never sufficient.
- Newly uploaded application attachments are request-owned until the submission persists and must be deleted on later validation or database failure. Reused profile media is never deleted.

**Why:** Contact details are editable application data, not proof of profile ownership; treating them as ownership can attach another Talent's private video. Failed submissions must not leave private-object orphans.

**How to apply:** Keep application videos under the private application-video namespace, persist their URL and original name on the submission, and expose playback only through an authenticated application-review proxy.

## Frontend gate screen
Unauthenticated users (no `talent_profile_token`, no legacy JWT, not a non-talent role) see a gate card with:
- "Create Talent Account & Apply" → `/talent/signup?returnTo=…`
- "Sign In to Existing Account" → `/portal-login?portal=talent&returnTo=…`

The gate renders only after `isLoadingTalent=false` so there's no flash.
