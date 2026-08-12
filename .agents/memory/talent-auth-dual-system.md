---
name: Talent auth dual-system quirks
description: Two separate auth systems coexist; how they interact and what each component must check.
---

## The two auth systems

| System | Token key | Payload | Set by |
|--------|-----------|---------|--------|
| Main JWT | `onspot_jwt_token` + `onspot_user` | `{userId, email, role}` | `authAPI.login()` / regular login page |
| Talent portal | `talent_profile_token` | `{token: "<JWT>"}` where JWT has `{type:"candidate", candidateId, email}` | `TalentLoginModal` |

## AuthContext

`AuthContext.refreshAuth()` now checks BOTH tokens (main JWT first, then talent portal token).
- For talent tokens: calls `GET /api/profiles/me` with the talent token to get the backend-resolved `userId` (server looks up `users` by email).
- Populates `user` state so all `enabled: !!user?.id` guards fire correctly.
- If talent token is expired or server rejects it (401), clears `localStorage.removeItem("talent_profile_token")`.

**Why:** `useTalentProfile` queries use `enabled: !!user?.id`. Without AuthContext recognising the talent token, `user` stayed null → queries never fired → profile never loaded for talent-portal-only logins.

## Axios interceptor (`api.ts`)

`getBearerToken()` prefers `onspot_jwt_token`, falls back to `talent_profile_token.token`.
Applied in both `api.ts` request interceptor and `queryClient.ts` `getBearerToken()`.

**FormData fix**: When `config.data instanceof FormData`, delete the `Content-Type` header BEFORE setting Authorization. Without this, the instance-level default `"Content-Type: application/json"` overrides FormData, multer can't parse the multipart body, and the server returns 400 "No file uploaded".

## Backend `authenticateJWT` (`server/routes.ts`)

Accepts both token types:
- Standard JWT (`{userId, email, role}`) → looks up user in DB, sets `req.user`
- Candidate JWT (`{type:"candidate", candidateId, email}`) → looks up user by email, uses users.id if found, falls back to candidateId

## Candidate name storage (first_name / last_name)

`candidates` table now has `first_name` + `last_name` columns (nullable, added via migration).
- PATCH route writes all three: `firstName`, `lastName`, and derives `fullName = trim(firstName + " " + lastName)`
- Hook sends `{ firstName, lastName }` — never re-splits `fullName`
- Load: prefers `candidate.firstName`/`candidate.lastName` when non-empty; falls back to `legacyNameFallback(fullName)` (splits at last space, NOT first) only for old rows
- `legacyNameFallback("A B C D")` → `{ firstName: "A B C", lastName: "D" }` — all words except last go to firstName

**Why:** `splitFullName` put only the first word as firstName, breaking compound given names like "Frenzy Val Eloise".

## ProfileSettings canonical data layer (definitive fix)

Settings page now uses `candidates` as the ONLY source of truth for talent data.
- New hook: `client/src/hooks/useCandidateProfileSettings.ts`
- Uses `loadTalentAuth()` from TalentLoginModal (not AuthContext/onspot_jwt_token)
- Fetches GET `/api/candidates/:id` (public) for form defaults
- Saves via PATCH `/api/candidates/:id` with talent Bearer token
- Photos via POST `/api/candidates/:id/photo` (authenticateTalentJWT)
- Timezone/languages/hourlyRate/rateCurrency stored in `preferences` JSONB (merged, not replaced)
- `fullName` = `${firstName} ${lastName}.trim()` (split on load, join on save)
- Skills → `coreSkills` string array on candidates table (NOT user_skills)
- Photo URL helper: `candidatePhotoSrc()` converts `/objects/candidate-photos/x` → `/api/candidate-photos/x`

**Why:** The old code was saving to `profiles` table (legacy system) while TalentProfile reads `candidates`. Two disconnected sources of truth.

## Double-toast prevention (`useTalentProfile.ts`)

`profileMutation.onError` must NOT show a toast — the caller (`ProfileSettings.onSubmit`) already wraps `mutateAsync` in try/catch and shows its own error toast. Having both fires two toasts for the same error.

**How to apply:** Any mutation whose result is always awaited by a caller that has its own error UI → remove the `onError` toast; keep only `console.error`.
