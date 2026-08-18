---
name: Resume auto-fill pipeline
description: Architecture for parsing resumes and applying extracted data to the Candidate profile from any upload entry point.
---

## Rule
All resume upload entry points must call `applyResumeToCandidate` after saving the file. Never duplicate parsing logic in individual pages.

**Why:** Each page previously saved the resume URL only. Talent had to manually re-enter information already in their CV. The pipeline gives ONE shared path: upload → parse → merge → PATCH candidate → invalidate caches.

**How to apply:** After any successful `POST /api/candidates/:id/resume`, call:
```ts
import { applyResumeToCandidate } from "@/lib/applyResumeToCandidate";
const { appliedFields, parseError } = await applyResumeToCandidate({ file, candidateId, token, queryClient });
```

## Key files
- `client/src/lib/resumeParser.ts` — extended `ExtractedCandidateProfile` with `languages`, `workHistory`, `education`, `certifications`; new section headers for certifications/languages
- `client/src/lib/applyResumeToCandidate.ts` — shared pipeline + `mergeResumeWithCandidate()` merge helper
- `client/src/lib/candidateCache.ts` — `invalidateCandidateQueries` called at the end of every pipeline run

## Merge rules (non-destructive)
- Scalar fields (phone, location, targetPosition): **always overwrite** from resume if parsed non-empty — allows a re-uploaded resume to refresh contact/title
- `summary`: **only fill when existing is empty** — preserves manually authored About/Bio
- Skill arrays: case-insensitive union (add new, keep existing)
- workHistory / education / certifications: add new entries (dedup by normalized title+company / school+degree / cert name); never remove existing
- languages: case-insensitive union, stored in `candidate.preferences.languages`; all other preference keys preserved

## Entry points updated
1. TalentProfile → `handleResumeUpload` — calls pipeline after POST /resume; button shows "Analyzing resume…" spinner
2. ProfileSettings → `uploadResume` — same
3. FindBestMatches — parser extracts workHistory/education/certifications/languages into profile state; all included in PATCH payload at submission; DB hydration also reads these fields from existing candidate

## Entry points NOT yet updated
- GetHired → uses Uppy direct-to-S3; no File object accessible in handleUploadComplete in current architecture; left as future work

## Important quirks
- `KNOWN_LANGUAGES` is a `Set<string>` — iterate with `Array.from()` to avoid TS2802 downlevelIteration error
- FindBestMatches previously declared a local `WorkHistoryEntry` interface; it is now removed and imported from resumeParser
- Server PATCH `/api/candidates/:id` already accepts `workHistory`, `education`, `certifications` (arrays) and merges `preferences` — no server changes required
