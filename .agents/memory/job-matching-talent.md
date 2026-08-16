---
name: Talent job matching surface
description: Non-obvious constraints around calculateJobMatches, job skill data source, and confidential-job redaction
---

- **Job skills live in `jobs.skillTags`**, not the `job_skills` table (empty in prod-like data). Any code returning `Job & { skills: [] }` silently breaks the match scorer, which filters jobs by skill overlap.
  **Why:** DbStorage.searchJobsWithSkills used to hardcode `skills: []`, making every candidate with skills get zero real matches.
  **How to apply:** when adding job queries feeding the scorer, populate `skills` from `skillTags`.
- **Legacy candidates may have `candidates.userId = null`** — they cannot be resolved via getCandidateByUserId. Pass the candidate record explicitly (calculateJobMatches accepts a candidateOverride) and fall back to candidate coreSkills/secondarySkills when user_skills is empty.
- **Confidential jobs must have company fields redacted server-side** in any endpoint returning raw job rows to talent (same guard as public job search; see server/tests/confidential-search.test.ts).
- Client-side match caching must scope React Query keys by the authenticated candidateId, or account switching in one browser leaks another talent's cached matches.
