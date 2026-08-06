---
name: Profile Strength / Completion Calculation Fix
description: Root causes and fix for the 80% → 17% profile completion bug. Single source of truth now in profileCompletion.ts.
---

## Root causes (fixed)

1. **Three separate formulas** — `calculateProfileCompletion()` in `utils.ts` (weighted points), `completionItems()` local to `TalentProfile.tsx` (12-item equal-weight checklist), `ProfileCompletionStatus` in `CandidateProfile.tsx` (admin view, still separate — acceptable).

2. **Two different database tables** — `profiles` table used by `useTalentProfile` hook / onboarding / ProfileSettings; `candidates` table used by TalentProfile page. Same user, two records. Same user filling in Profile Settings saw 80% (profiles system); visited TalentProfile page and saw 17% (candidates system — empty record).

3. **`portfolioItems: []` hardcoded** in `useTalentProfile.ts` — portfolio never contributed to completion even if the user had items.

4. **Race condition** — `profileCompletion` was computed from `selectedSkills` and `uploadedDocuments` which were `useState` arrays populated via `useEffect`, so on first render they were `[]`.

5. **`bio.length >= 50` threshold** — profiles system penalised short bios; candidate system just checked `!!summary`.

6. **Post-save form-state recalculation** — `ProfileOnboarding` recalculated completion from form values (not server response), causing temporarily inflated numbers before the API data refreshed.

## Fix

**Why:** Single deterministic source of truth that both data systems map into.

**New file: `client/src/lib/profileCompletion.ts`**
- `ProfileStrengthInput` — 12 optional boolean fields; `undefined` = not tracked (excluded from denominator)
- `buildCompletionItems(input)` → `CompletionItem[]` (labelled checklist)
- `calcCompletionPct(items)` → 0–100 integer
- `profileStrengthFromCandidate(c)` — maps Candidate record → input (all 12 items, denominator = 12)
- `profileStrengthFromProfile(p)` — maps Profile + {hasSkills, hasResume, hasLinks} → input (8 items, email/experience/education/preferences are `undefined`; denominator = 8; can reach 100%)

**`useTalentProfile.ts`**
- Added `/api/talents/:userId/portfolio` query (was hardcoded `[]`)
- Added `persistedSkills` / `persistedDocuments` / `portfolioItems` computed via `useMemo` from query data — no race condition
- `profileCompletion` computed via `useMemo` from persisted server data, never from form state
- Kept `selectedSkills` / `setSelectedSkills` state for the toggle UI + mutations

**`TalentProfile.tsx`**
- Removed local `completionItems()` function
- Now calls `buildCompletionItems(profileStrengthFromCandidate(candidate))` + `calcCompletionPct()`

**`ProfileOnboarding.tsx`**
- Removed `latestCompletion` state + its effects
- Removed post-save form-state recalculation using `calculateProfileCompletion`
- Uses `profileCompletion` from hook directly (hook refetches after save)

**`utils.ts`** — `calculateProfileCompletion` kept as deprecated wrapper that delegates to the new module for backward compat.

## Tests

`client/src/lib/profileCompletion.test.ts` — 33 tests covering:
- determinism (same input → same output always)
- same data returns same % across 10 repeated calls (regression for the 80→17 bug)
- edge cases: empty workHistory, malformed preferences, whitespace-only names, location = "Global", short bio
- denominator exclusion (email/experience/education/preferences = undefined in profiles system)

**How to apply:** Any new page or component that shows profile completion MUST import from `@/lib/profileCompletion` and call `buildCompletionItems` + `calcCompletionPct`. Never use form state to compute completion.
