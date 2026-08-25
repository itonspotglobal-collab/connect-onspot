---
name: Talent job matching surface
description: Non-obvious constraints around calculateJobMatches, job skill data source, and confidential-job redaction
---

- **Job skills live in `jobs.skillTags`**, not the `job_skills` table (empty in prod-like data). Any code returning `Job & { skills: [] }` silently breaks the match scorer, which filters jobs by skill overlap.
  **Why:** DbStorage.searchJobsWithSkills used to hardcode `skills: []`, making every candidate with skills get zero real matches.
  **How to apply:** when adding job queries feeding the scorer, populate `skills` from `skillTags`.
- **Structured job-form skill requirements supplement, rather than replace, `skillTags`.** The form records each selected skill's experience threshold separately and derives `skillTags` from the selected names.
  **Why:** matching and search use the tag array today, while a plain tag cannot represent a minimum-experience requirement.
  **How to apply:** preserve both representations in future job writes; do not switch matching to the structured field until the scorer is intentionally upgraded and migrated.
- **Legacy candidates may have `candidates.userId = null`** — they cannot be resolved via getCandidateByUserId. Pass the candidate record explicitly (calculateJobMatches accepts a candidateOverride) and fall back to candidate coreSkills/secondarySkills when user_skills is empty.
- **Confidential jobs must have company fields redacted server-side** in any endpoint returning raw job rows to talent (same guard as public job search; see server/tests/confidential-search.test.ts).
- Client-side match caching must scope React Query keys by the authenticated candidateId, or account switching in one browser leaks another talent's cached matches.
