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
- `server/services/vanessaResumeAnalyzer.ts` — `analyzeResumeWithVanessa(resumeText, candidateId?)` using OpenAI Chat Completions (`gpt-4o`, `json_object` mode). NOT the Assistants API. Same OPENAI_API_KEY. Resume content is NEVER written to RAG/global knowledge.
- `server/routes.ts` — `POST /api/resume/analyze` calls Vanessa, returns `{ success, source, parserVersion, profile }`. Returns 503 (not 500) on Vanessa failure so client falls back gracefully.
- `client/src/lib/resumeParser.ts` — extended `ExtractedCandidateProfile` with `languages`, `workHistory`, `education`, `certifications`; `extractTextFromFile` already exported.
- `client/src/lib/applyResumeToCandidate.ts` — tries `/api/resume/analyze` first; falls back to local `parseResumeFile()` on any error. Returns `analysisSource: "vanessa" | "deterministic"`.
- `client/src/lib/candidateCache.ts` — `invalidateCandidateQueries` called at the end of every pipeline run
- `server/tests/vanessa-resume.test.ts` — 16 regression tests for validation rules (email→experience, degree→title, HTML strip, etc.)

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

## Vanessa-specific rules
- System prompt lives entirely in `vanessaResumeAnalyzer.ts` — do NOT use the Assistants API or the normal chat system prompt
- Confidence thresholds: >= 0.80 = auto-fill empty fields; 0.60–0.79 = corroborated fields only; < 0.60 = suppress
- Validation rejects: email/phone as title, degree patterns as title, university names as title, section headings as title, experience entries with no title+company, experience entries where jobTitle is an email
- `cleanText()` strips all HTML tags + entities before any field is persisted
- Programming languages (Java, Python, C#, etc.) are filtered from `personalInfo.languages` before returning
- Resume text truncated at 8000 chars before OpenAI call to stay within token budget
- Model: `gpt-4o` with `temperature: 0.1` (low temp for deterministic extraction)

## Important quirks
- `KNOWN_LANGUAGES` is a `Set<string>` — iterate with `Array.from()` to avoid TS2802 downlevelIteration error
- FindBestMatches previously declared a local `WorkHistoryEntry` interface; it is now removed and imported from resumeParser
- Server PATCH `/api/candidates/:id` already accepts `workHistory`, `education`, `certifications` (arrays) and merges `preferences` — no server changes required
- Vanessa `responsibilities` is `string[]` on the server but `WorkHistoryEntry.responsibilities` is `string` — join with `"\n"` when mapping
