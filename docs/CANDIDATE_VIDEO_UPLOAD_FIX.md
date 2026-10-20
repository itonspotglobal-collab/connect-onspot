# Talent profile video upload: HTTP 413 fix

## Confirmed cause

On 2026-10-20, the same 63 MiB multipart probe was sent without authentication to a nonexistent candidate ID, so no profile could be updated:

- Development preview: HTTP 401 JSON, `x-powered-by: Express`, application request ID. All 66,060,500 request bytes, including multipart overhead, reached the application.
- Published site: HTTP 413 HTML, `server: Google Frontend`, `via: 1.1 google`, with no Express request ID. The body was Google's “Request Entity Too Large” page.
- Existing shared Multer configuration already allows 200 × 1024 × 1024 bytes. The video handler's size check therefore was not the source of this reproduced 63 MiB production rejection.

This identifies the published ingress as the rejecting layer. It does not measure its exact threshold. Increasing Express/Multer limits cannot resolve that ingress response.

## Implemented flow

Both Talent Profile and Profile Settings now use the same direct uploader:

1. Validate size and format locally. The unchanged maximum is **209,715,200 bytes (200 MiB, labeled 200 MB in existing UI)**.
2. Send a small authenticated JSON authorization request to `POST /api/candidates/:id/video/uploads`.
3. The server verifies existing candidate/Talent ownership and candidate existence, then authorizes a random quarantine object through the existing private storage provider. Signed PUT authorization and the separately scoped completion capability expire after 15 minutes.
4. The browser sends raw video bytes directly to storage using XHR. Application authorization is never sent to storage. No Base64, application-proxy video body or server-side 200 MB buffer is used.
5. `POST .../video/uploads/complete` authenticates the owner again, verifies the capability, actual stored size, MIME and video header, then copies the inspected immutable object generation to a new final private object with a no-overwrite precondition.
6. Only after successful private publication does a compare-and-swap update persist `video_intro_url` and `video_intro_file_name`. A stale competing upload cannot overwrite a more recent profile edit. Completion retries are idempotent.
7. Both pages refresh their existing candidate queries. Their recording controls, video URL/filename fields, playback URLs and delete endpoint remain in place.

Replacement retains older committed video objects because existing job applications can still reference them. Failed new uploads and stale contenders are cleaned up, not substituted into profile metadata.

### Compatibility and error handling

- Existing `POST /api/candidates/:id/video` remains available, with auth checked before multipart parsing, a video-only disk-backed Multer parser, an inclusive 200 MiB bound, controlled JSON parser errors and streaming from temporary disk to storage.
- Existing resume middleware/limits and application/resume functionality were not changed.
- Oversize videos return 413 with: “Your video exceeds the 200 MB limit. Please upload a smaller video.”
- Unsupported types return 400/415; missing multipart files return 400; unauthorized requests return 401/403; storage failures return controlled 5xx responses without provider errors or stack traces.
- Both frontends validate before upload, synchronously guard against duplicate submission, display progress for uploads and recorded-video saves, distinguish non-JSON infrastructure 413 from actual oversize, and retain recordings if upload fails.
- Temporary files are removed after legacy uploads. Direct-upload failure/cancel removes quarantine objects. A bounded cleanup on subsequent upload initiation removes abandoned quarantine objects older than one hour, up to 100 objects per pass. This is best-effort maintenance, not a guarantee of immediate cleanup after a browser crash; no unrelated bucket lifecycle policy was changed.
- Signed PUTs authorize only one random quarantine key, not public writes. Final objects have separate keys and cannot be overwritten with that authorization. Untrusted staging size is checked before publication; a signed PUT itself does not reserve a provider-side hard byte quota.
- If a database write's acknowledgement is lost, the handler rechecks the committed profile before deleting anything. Unknown commit state preserves the possible referenced object for reconciliation rather than breaking playback.

## Verification

### Actual storage/network, fixture account/database

`npx tsx scripts/verify-candidate-video-storage.ts --execute`

Generated playable MP4 fixtures with valid padding; uploaded through actual signed storage URLs, verified through the real route handlers, checked private ACLs, persisted byte counts and the original readable video prefix. Every temporary test object was scheduled for deterministic deletion in the runner's `finally` block; no cleanup failure was reported.

| Size | Actual private storage PUT | Completion | Stored bytes |
|---|---|---|---|
| 5 MiB | 200 | 200 | 5,242,880 |
| 30 MiB | 200 | 200 | 31,457,280 |
| 63 MiB | 200 | 200 | 66,060,288 |
| 100 MiB | 200 | 200 | 104,857,600 |
| 200 MiB | 200 | 200 | 209,715,200 |

Storage preflight accepted the development preview origin.

`npx tsx scripts/verify-candidate-video-storage.ts --execute --browser63`

An actual Chromium browser ran the production shared uploader against the real storage provider with a 63 MiB MP4 file: browser CORS/XHR, progress, authorization, completion and private persisted size passed. The script uses a disposable local route server, signed fixture identity and in-memory profile persistence; it does not use a real Talent account or the application database.

### Isolated regression checks

- 46 backend tests passed across candidate-media, direct-video-upload and Talent document URL suites. Coverage includes supported size boundaries, unauthorized/other-candidate/admin denial, invalid/expired capabilities, authoritative size/type/header rejection, replacement, stale competing uploads, retries, cancellation, storage/DB failures, legacy delete/resume behavior and existing document ACLs.
- 6 browser/source-contract tests passed: actual XHR bodies at 5 and 63 MiB against a local receiver, progress, no application credential leakage to storage, oversize/type validation before network use, HTML 413 handling, cancellation on failed save, and shared-uploader/busy/refresh wiring in both profile pages. These are not full authenticated page tests.
- TypeScript and all production build stages passed.
- Development application restarted and served requests; all four video mutation paths denied anonymous requests with 401.
- Screenshot of `/settings` showed the existing sign-in gate. **The signed-in Talent Profile and Settings UI was not verified with an actual account.**

Existing unrelated Lindy embed/Stripe configuration warnings and the admin-auth diagnostic network failure remain outside this fix.

## Deployment boundary and remaining checks

- No publication, production migration, production account mutation or real profile video update was performed.
- No schema migration, new storage provider or global request-limit change is required by this fix.
- Production will retain the old failing route usage until the updated frontend and backend are published together.
- Verify the published deployment has its own intended private-storage configuration and permits its actual browser origins. Development storage success alone does not prove production credentials/bucket access.
- After authorized release, use an approved Talent account to upload, play/seek, refresh, replace and delete from both pages, including a recorded video. This live-account check remains outstanding; no password or session token should be shared in chat.
- Old clients that still post large multipart video bodies through the production ingress can still receive its infrastructure 413. The supported new frontend avoids that route for video bytes.

## Changed files

Application code:

- `shared/candidateVideo.ts`
- `client/src/lib/uploadCandidateVideo.ts`
- `client/src/pages/TalentProfile.tsx`
- `client/src/pages/ProfileSettings.tsx`
- `server/routes/candidateVideoUploads.ts`
- `server/services/candidateVideoStorage.ts`
- `server/routes/candidateMedia.ts`
- `server/routes.ts`
- `server/objectStorage.ts`

Tests, verification and documentation:

- `server/tests/candidate-media.test.ts`
- `server/tests/candidate-video-uploads.test.ts`
- `browser-tests/candidate-video.browser.test.ts`
- `scripts/verify-candidate-video-storage.ts`
- `docs/CANDIDATE_VIDEO_UPLOAD_FIX.md`

Project memory records the observed ingress constraint separately; packages, authentication implementations, database schema, workflow commands and deployment settings were not changed.
